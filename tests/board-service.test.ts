import { beforeEach, describe, expect, test } from "vitest";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { buildTestTree, ID } from "./helpers";

const WORKSPACE_ID = "ws_test";

async function loadBoard() {
  await useBoardStore.getState().load(ID.roadmap);
  const board = useBoardStore.getState().board;
  if (!board) throw new Error("board did not load");
  return board;
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  boardService.reset();

  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    selectedIds: [],
    feedback: null,
    seed: 0,
  });

  useBoardStore.setState({
    nodeId: null,
    status: "idle",
    error: null,
    board: null,
    rowsById: {},
    rowOrder: [],
    people: [],
    activeViewId: null,
    search: "",
    pendingWrites: 0,
    conflicts: [],
  });
});

describe("board service", () => {
  test("a board seeds its schema, records and saved views", async () => {
    const snapshot = await boardService.getBoard(ID.roadmap);

    expect(snapshot.board.rowIdPrefix).toBe("TASK");
    expect(snapshot.board.columns.some((column) => column.isPrimary)).toBe(true);
    expect(snapshot.board.views.length).toBeGreaterThan(1);
    expect(snapshot.rows).toHaveLength(4);
    expect(snapshot.rows[0]?.displayId).toBe("TASK-001");
    expect(snapshot.nextCursor).toBeNull();
  });

  test("the backend owns the counter — a deleted number is never reused", async () => {
    const { board } = await boardService.getBoard(ID.roadmap);

    const created = await boardService.createRow({ boardId: board.id });
    expect(created.displayId).toBe("TASK-005");

    await boardService.deleteRow(board.id, created.id);
    const next = await boardService.createRow({ boardId: board.id });

    expect(next.displayId).toBe("TASK-006");
  });

  test("a duplicate copies the cells but gets its own identity", async () => {
    const { board, rows } = await boardService.getBoard(ID.roadmap);
    const source = rows[0]!;

    const copy = await boardService.duplicateRow(board.id, source.id);

    expect(copy.id).not.toBe(source.id);
    expect(copy.displayId).not.toBe(source.displayId);
    expect(copy.cells).toEqual(source.cells);
  });

  test("a stale write is applied last-write-wins and reported as a conflict", async () => {
    const { board, rows } = await boardService.getBoard(ID.roadmap);
    const row = rows[0]!;
    const edit = {
      rowId: row.id,
      columnId: board.primaryColumnId,
      value: { kind: "text" as const, value: "Fresh" },
    };

    await boardService.updateCells({ boardId: board.id, edits: [edit] });

    const stale = await boardService.updateCells({
      boardId: board.id,
      edits: [{ ...edit, value: { kind: "text", value: "Stale" } }],
      baseRevisions: { [row.id]: row.revision },
    });

    expect(stale.conflicts).toHaveLength(1);
    expect(stale.rows[0]?.cells[board.primaryColumnId]).toEqual({ kind: "text", value: "Stale" });
  });

  test("converting a column rewrites values and counts what it kept as text", async () => {
    const { board } = await boardService.getBoard(ID.roadmap);

    const result = await boardService.convertColumn(board.id, board.primaryColumnId, "date");

    expect(result.column.type).toBe("date");
    expect(result.preserved).toBeGreaterThan(0);
    expect(result.rows[0]?.cells[board.primaryColumnId]).toMatchObject({ kind: "date", iso: null });
  });

  test("rows are searchable by display id and by title", async () => {
    const { board } = await boardService.getBoard(ID.roadmap);

    expect((await boardService.searchRows(board.id, "TASK-002"))[0]?.displayId).toBe("TASK-002");
    expect(await boardService.searchRows(board.id, "nothing-matches-this")).toHaveLength(0);
  });

  test("creating a select option appends it to the column schema", async () => {
    const { board } = await boardService.getBoard(ID.roadmap);
    const select = board.columns.find((column) => column.type === "select");
    if (!select) throw new Error("fixture missing a select column");

    const option = await boardService.createSelectOption(board.id, select.id, "Deferred", "amber");
    const refreshed = await boardService.getBoard(ID.roadmap);
    const updated = refreshed.board.columns.find((column) => column.id === select.id);

    expect(option.label).toBe("Deferred");
    expect(updated?.type === "select" && updated.config.options.at(-1)?.label).toBe("Deferred");
  });
});

describe("board store mutations", () => {
  test("an added row is optimistic first, then takes the server identity", async () => {
    const board = await loadBoard();
    const before = useBoardStore.getState().rowOrder.length;

    const promise = useBoardStore.getState().addRow();

    const optimisticId = useBoardStore.getState().rowOrder.at(-1) ?? "";
    expect(optimisticId.startsWith("tmp_")).toBe(true);
    expect(useBoardStore.getState().rowsById[optimisticId]?.displayId).toBe(
      `${board.rowIdPrefix}-…`,
    );

    const created = await promise;
    const order = useBoardStore.getState().rowOrder;

    expect(order).toHaveLength(before + 1);
    expect(order.at(-1)).toBe(created);
    expect(useBoardStore.getState().rowsById[created ?? ""]?.displayId).toBe("TASK-005");
  });

  test("a failed cell write rolls back to the value it overwrote", async () => {
    const board = await loadBoard();
    const rowId = useBoardStore.getState().rowOrder[0]!;
    const before = useBoardStore.getState().rowsById[rowId]?.cells[board.primaryColumnId];

    setSimulation({ failSaves: true });

    await useBoardStore.getState().editCells([
      { rowId, columnId: board.primaryColumnId, value: { kind: "text", value: "Never lands" } },
    ]);

    expect(useBoardStore.getState().rowsById[rowId]?.cells[board.primaryColumnId]).toEqual(before);
  });

  test("a successful cell write reconciles to the server revision", async () => {
    const board = await loadBoard();
    const rowId = useBoardStore.getState().rowOrder[0]!;
    const revision = useBoardStore.getState().rowsById[rowId]?.revision ?? 0;

    await useBoardStore.getState().editCells([
      { rowId, columnId: board.primaryColumnId, value: { kind: "text", value: "Saved" } },
    ]);

    const row = useBoardStore.getState().rowsById[rowId];

    expect(row?.cells[board.primaryColumnId]).toEqual({ kind: "text", value: "Saved" });
    expect(row?.revision).toBe(revision + 1);
    expect(useBoardStore.getState().pendingWrites).toBe(0);
  });

  test("a failed delete puts the row back where it was", async () => {
    await loadBoard();
    const order = useBoardStore.getState().rowOrder;
    const rowId = order[1]!;

    setSimulation({ failSaves: true });
    await useBoardStore.getState().deleteRow(rowId);

    expect(useBoardStore.getState().rowOrder).toEqual(order);
  });

  test("hiding a column changes the view, never the schema", async () => {
    const board = await loadBoard();
    const columnId = board.columns[1]!.id;

    await useBoardStore.getState().setColumnHidden(columnId, true);

    const state = useBoardStore.getState();
    expect(state.board?.views[0]?.hiddenColumnIds).toContain(columnId);
    expect(state.board?.columns.find((column) => column.id === columnId)?.hidden).toBe(false);
  });
});
