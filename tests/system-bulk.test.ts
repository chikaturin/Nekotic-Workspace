import { beforeEach, describe, expect, test, vi } from "vitest";
import { partitionBulkTargets, describeBulkResult, bulkTone } from "@/lib/bulk";
import { isRowArchived } from "@/lib/archive";
import { boardService } from "@/services/board-service";
import { boardIdFor } from "./msw/fake/board.fake";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardRow, BulkResult } from "@/types";
import { buildTestTree, csvFile, ID, mapToColumns, TEST_WORKSPACE } from "./helpers";

/**
 * SY-BLK-34 — bulk actions.
 *
 * The contract under test is not "the values changed" but "one request changed
 * them, and the answer accounts for every id that was sent".
 */

const WORKSPACE_ID = "ws_test";
const ROADMAP_BOARD = boardIdFor(ID.roadmap);
const rowIdAt = (index: number) => `${ROADMAP_BOARD}_row_${index}`;

async function loadBoard() {
  await useBoardStore.getState().load(ID.roadmap);
  const board = useBoardStore.getState().board;
  if (!board) throw new Error("board did not load");
  return board;
}

function columnNamed(name: string): string {
  const column = useBoardStore.getState().board?.columns.find((candidate) => candidate.name === name);
  if (!column) throw new Error(`no column named ${name}`);
  return column.id;
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  useGridStore.getState().reset();

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    trashByWorkspace: { [WORKSPACE_ID]: [] },
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
    isShowingArchived: false,
  });
});

describe("partitioning a selection", () => {
  const row = (id: string, archivedAt?: string): BoardRow => ({
    id,
    boardId: "brd",
    displayId: id.toUpperCase(),
    sequence: 1,
    cells: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "usr",
    revision: 1,
    ...(archivedAt ? { archivedAt } : {}),
  });

  test("every requested id lands in exactly one bucket", () => {
    const rows = new Map([
      ["a", row("a")],
      ["b", row("b", "2026-08-02T00:00:00.000Z")],
    ]);

    const { targets, skipped } = partitionBulkTargets(["a", "b", "gone"], (id) => rows.get(id));

    expect(targets.map((target) => target.id)).toEqual(["a"]);
    expect(skipped).toEqual([
      { rowId: "b", displayId: "B", reason: "archived" },
      { rowId: "gone", displayId: "gone", reason: "not_found" },
    ]);
    expect(targets.length + skipped.length).toBe(3);
  });

  test("restoring is the one write an archived record still accepts", () => {
    const rows = new Map([["b", row("b", "2026-08-02T00:00:00.000Z")]]);

    const { targets } = partitionBulkTargets(["b"], (id) => rows.get(id), { allowArchived: true });
    expect(targets).toHaveLength(1);
  });

  test("a partial run reports both halves and reads as info, not success", () => {
    const result: BulkResult = {
      requested: 3,
      rows: [],
      applied: ["a"],
      skipped: [{ rowId: "b", displayId: "B", reason: "archived" }],
    };

    expect(describeBulkResult(result, "Updated")).toBe("Updated 1 record · 1 skipped (archived)");
    expect(bulkTone(result)).toBe("info");
    expect(bulkTone({ ...result, skipped: [] })).toBe("success");
    expect(bulkTone({ ...result, applied: [] })).toBe("error");
  });
});

describe("bulk writes", () => {
  test("100 records are written by one call, not one call per record", async () => {
    const board = await loadBoard();

    // Grow the board past the metric in the PRD, then write across all of it.
    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const outcome = await boardService.importRows({
      boardId: board.id,
      file: csvFile("bulk.csv", [
        ["Title"],
        ...Array.from({ length: 96 }, (_, index) => [`Bulk ${index + 1}`]),
      ]),
      mappings: mapToColumns([titleId]),
      invalidPolicy: "skip",
    });
    expect(outcome.rowIds).toHaveLength(96);

    const rowIds = [...Array.from({ length: 4 }, (_, index) => rowIdAt(index + 1)), ...outcome.rowIds];
    expect(rowIds).toHaveLength(100);

    const statusId = columnNamed("Status");
    const option = board.columns.find((column) => column.id === statusId);
    const optionId = option?.type === "select" ? option.config.options[0]?.id : undefined;
    if (!optionId) throw new Error("status column has no options");

    const bulkSpy = vi.spyOn(boardService, "bulkUpdate");
    const singleSpy = vi.spyOn(boardService, "updateCells");

    const result = await useBoardStore
      .getState()
      .bulkUpdate(rowIds, { [statusId]: { kind: "select", optionIds: [optionId] } });

    expect(bulkSpy).toHaveBeenCalledTimes(1);
    expect(bulkSpy.mock.calls[0]?.[0].rowIds).toHaveLength(100);
    expect(singleSpy).not.toHaveBeenCalled();
    expect(result?.applied).toHaveLength(100);

    bulkSpy.mockRestore();
    singleSpy.mockRestore();
  });

  test("archived records are skipped and the rest are still written", async () => {
    const board = await loadBoard();
    const statusId = columnNamed("Status");

    await boardService.bulkArchive({
      boardId: board.id,
      rowIds: [rowIdAt(1), rowIdAt(2)],
      isArchived: true,
    });

    const result = await boardService.bulkUpdate({
      boardId: board.id,
      rowIds: [rowIdAt(1), rowIdAt(2), rowIdAt(3), rowIdAt(4)],
      values: { [statusId]: { kind: "select", optionIds: [] } },
    });

    expect(result.requested).toBe(4);
    expect(result.applied).toEqual([rowIdAt(3), rowIdAt(4)]);
    expect(result.skipped.map((skip) => skip.reason)).toEqual(["archived", "archived"]);
  });

  test("archiving is reversible and leaves the record readable", async () => {
    const board = await loadBoard();

    const archived = await boardService.bulkArchive({
      boardId: board.id,
      rowIds: [rowIdAt(1)],
      isArchived: true,
    });
    expect(archived.rows[0] && isRowArchived(archived.rows[0])).toBe(true);

    const restored = await boardService.bulkArchive({
      boardId: board.id,
      rowIds: [rowIdAt(1)],
      isArchived: false,
    });
    expect(restored.rows[0] && isRowArchived(restored.rows[0])).toBe(false);

    const snapshot = await boardService.getBoard(ID.roadmap);
    expect(snapshot.rows.some((row) => row.id === rowIdAt(1))).toBe(true);
  });

  test("a frozen record can still be deleted — archiving stops edits, not removal", async () => {
    const board = await loadBoard();

    await boardService.bulkArchive({ boardId: board.id, rowIds: [rowIdAt(1)], isArchived: true });
    const result = await boardService.bulkDelete({ boardId: board.id, rowIds: [rowIdAt(1)] });

    expect(result.applied).toEqual([rowIdAt(1)]);
    expect(result.skipped).toHaveLength(0);

    const snapshot = await boardService.getBoard(ID.roadmap);
    expect(snapshot.rows.some((row) => row.id === rowIdAt(1))).toBe(false);
  });

  test("the store drops deleted records from both the map and the order", async () => {
    await loadBoard();

    await useBoardStore.getState().bulkDelete([rowIdAt(1), rowIdAt(2)]);

    const { rowsById, rowOrder } = useBoardStore.getState();
    expect(rowsById[rowIdAt(1)]).toBeUndefined();
    expect(rowOrder).not.toContain(rowIdAt(2));
    expect(rowOrder).toContain(rowIdAt(3));
  });
});

describe("moving records to another board", () => {
  async function createBugBoard() {
    const node = useWorkspaceStore.getState().createBoard(ID.backend, "Bug tracker", "bug");
    if (!node) throw new Error("board was not created");
    return node;
  }

  test("records arrive with the destination's own ids and leave the source", async () => {
    const board = await loadBoard();
    const target = await createBugBoard();

    if (target === null) throw new Error("destination board was not created");

    const result = await boardService.bulkMove({
      boardId: board.id,
      rowIds: [rowIdAt(1), rowIdAt(2)],
      targetNodeId: target.id,
    });

    expect(result.applied).toEqual([rowIdAt(1), rowIdAt(2)]);
    expect(result.rows.map((row) => row.displayId)).toEqual(["BUG-001", "BUG-002"]);

    const source = await boardService.getBoard(ID.roadmap);
    expect(source.rows.map((row) => row.id)).not.toContain(rowIdAt(1));

    const destination = await boardService.getBoard(target.id);
    expect(destination.rows).toHaveLength(2);
  });

  test("columns the destination has no counterpart for are reported by name", async () => {
    const board = await loadBoard();
    const target = await createBugBoard();

    if (target === null) throw new Error("destination board was not created");

    const result = await boardService.bulkMove({
      boardId: board.id,
      rowIds: [rowIdAt(1)],
      targetNodeId: target.id,
    });

    // Both boards have Status and Assignee; Title/Priority/Due date do not exist
    // on a bug board and are named rather than dropped in silence.
    expect(result.droppedColumns).toContain("Title");
    expect(result.droppedColumns).toContain("Priority");
    expect(result.droppedColumns).not.toContain("Status");
  });

  test("moving to the board the records are already on is refused", async () => {
    const board = await loadBoard();

    await expect(
      boardService.bulkMove({ boardId: board.id, rowIds: [rowIdAt(1)], targetNodeId: ID.roadmap }),
    ).rejects.toThrow(/already on that board/i);
  });
});
