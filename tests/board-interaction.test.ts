import { beforeEach, describe, expect, test } from "vitest";
import { columnVisual, VIEW_TYPE_LABELS } from "@/lib/board-visuals";
import { makeColumn, nextOptionColor, SELECT_COLOR_CLASSES, upsertColumn } from "@/lib/board-schema";
import { compareRows, matchesFilter, resolveColumns } from "@/lib/board-view";
import {
  cellText,
  formatDateTime,
  hasUnparsedText,
  optionById,
} from "@/lib/cell-values";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import {
  selectBox,
  selectFocus,
  selectIsEditing,
  selectIsFocused,
  selectIsSelected,
  useGridStore,
} from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Board, BoardColumn, BoardColumnOf, BoardRow, SavedView, ViewFilter } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";
import { boardFake } from "./msw/fake/board.fake";

const WORKSPACE_ID = "ws_test";
const BOUNDS = { rowCount: 10, columnCount: 4 };

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  useGridStore.getState().reset();

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    selectedIds: [],
    feedback: null,
    seed: 0,
  });
});

/* ------------------------------------------------------------- grid store */

describe("grid interaction state", () => {
  test("focusing a cell collapses the range to it", () => {
    const grid = useGridStore.getState();
    grid.focusCell({ rowIndex: 2, columnIndex: 1 });

    expect(selectFocus(useGridStore.getState())).toEqual({ rowIndex: 2, columnIndex: 1 });
    expect(selectIsFocused(2, 1)(useGridStore.getState())).toBe(true);
    expect(selectIsFocused(2, 0)(useGridStore.getState())).toBe(false);
  });

  test("shift-moving extends from the anchor", () => {
    const grid = useGridStore.getState();
    grid.focusCell({ rowIndex: 1, columnIndex: 1 });
    grid.moveFocus("down", BOUNDS, true);
    grid.moveFocus("down", BOUNDS, true);

    expect(selectBox(useGridStore.getState())).toEqual({ top: 1, bottom: 3, left: 1, right: 1 });
    expect(selectIsSelected(2, 1)(useGridStore.getState())).toBe(true);
    expect(selectIsSelected(2, 2)(useGridStore.getState())).toBe(false);
  });

  test("a drag selection only extends while the pointer is down", () => {
    const grid = useGridStore.getState();
    grid.beginDragSelect({ rowIndex: 0, columnIndex: 0 });
    grid.dragSelectTo({ rowIndex: 2, columnIndex: 2 });

    expect(selectBox(useGridStore.getState())).toEqual({ top: 0, bottom: 2, left: 0, right: 2 });

    grid.endDragSelect();
    grid.dragSelectTo({ rowIndex: 5, columnIndex: 3 });

    expect(selectBox(useGridStore.getState())?.bottom).toBe(2);
  });

  test("editing and the drawer are independent of the selection", () => {
    const grid = useGridStore.getState();
    grid.beginEdit("r1", "c1", { initialText: "x" });

    expect(selectIsEditing("r1", "c1")(useGridStore.getState())).toBe(true);
    expect(useGridStore.getState().editing?.initialText).toBe("x");

    grid.focusCell({ rowIndex: 0, columnIndex: 0 });
    expect(useGridStore.getState().editing).toBeNull();

    grid.openDrawer("r7");
    expect(useGridStore.getState().drawerRowId).toBe("r7");
    grid.closeDrawer();
    expect(useGridStore.getState().drawerRowId).toBeNull();
  });
});

/* ------------------------------------------------------------ view engine */

describe("filters and comparators", () => {
  const status: BoardColumnOf<"select"> = {
    ...makeColumn("c_status", "Status", "select", 1),
    type: "select",
    config: {
      isMulti: false,
      options: [
        { id: "o_todo", label: "To do", color: "gray" },
        { id: "o_done", label: "Done", color: "green" },
      ],
    },
  };

  const due: BoardColumnOf<"date"> = {
    ...makeColumn("c_due", "Due", "date", 2),
    type: "date",
    config: { includesTime: true },
  };

  function row(cells: BoardRow["cells"]): BoardRow {
    return {
      id: "r1",
      boardId: "b1",
      displayId: "TASK-001",
      sequence: 1,
      cells,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      createdBy: "u1",
      revision: 1,
    };
  }

  const filter = (operator: ViewFilter["operator"], value = ""): ViewFilter => ({
    id: "f",
    columnId: "c_status",
    operator,
    value,
  });

  test("every text operator behaves", () => {
    const done = row({ c_status: { kind: "select", optionIds: ["o_done"] } });
    const empty = row({ c_status: { kind: "select", optionIds: [] } });

    expect(matchesFilter(done, filter("contains", "on"), status, {})).toBe(true);
    expect(matchesFilter(done, filter("notContains", "on"), status, {})).toBe(false);
    expect(matchesFilter(done, filter("is", "done"), status, {})).toBe(true);
    expect(matchesFilter(done, filter("isNot", "done"), status, {})).toBe(false);
    expect(matchesFilter(empty, filter("isEmpty"), status, {})).toBe(true);
    expect(matchesFilter(empty, filter("isNotEmpty"), status, {})).toBe(false);
  });

  test("date operators compare instants and ignore unparsable bounds", () => {
    const dated = row({ c_due: { kind: "date", iso: "2026-08-20T00:00:00.000Z" } });
    const undated = row({ c_due: { kind: "date", iso: null } });
    const dateFilter = (operator: "before" | "after", value: string): ViewFilter => ({
      id: "f",
      columnId: "c_due",
      operator,
      value,
    });

    expect(matchesFilter(dated, dateFilter("before", "2026-09-01"), due, {})).toBe(true);
    expect(matchesFilter(dated, dateFilter("after", "2026-09-01"), due, {})).toBe(false);
    expect(matchesFilter(dated, dateFilter("before", "gibberish"), due, {})).toBe(true);
    expect(matchesFilter(undated, dateFilter("before", "2026-09-01"), due, {})).toBe(false);
  });

  test("a sort on a missing column is skipped rather than throwing", () => {
    const a = row({ c_status: { kind: "select", optionIds: ["o_todo"] } });
    const b = row({ c_status: { kind: "select", optionIds: ["o_done"] } });
    const columns = new Map<string, BoardColumn>([["c_status", status]]);

    expect(compareRows(a, b, [{ columnId: "gone", direction: "asc" }], columns, {})).toBe(0);
    expect(compareRows(a, b, [{ columnId: "c_status", direction: "asc" }], columns, {})).toBeLessThan(0);
  });

  test("a board with no view falls back to schema order", () => {
    const board: Board = {
      id: "b1",
      nodeId: "n1",
      workspaceId: "ws",
      name: "B",
      rowIdPrefix: "TASK",
      primaryColumnId: "c_status",
      columns: [due, status],
      views: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(resolveColumns(board, null).map((column) => column.id)).toEqual(["c_status", "c_due"]);
  });
});

/* ---------------------------------------------------------- value helpers */

describe("value helpers", () => {
  const attachments: BoardColumn = makeColumn("c_files", "Files", "attachment", 0);
  const relation: BoardColumn = makeColumn("c_rel", "Blocked by", "relation", 1);

  test("attachment and relation projections read their own shapes", () => {
    expect(
      cellText(
        {
          kind: "attachment",
          attachments: [
            { id: "a1", name: "shot.png", mimeType: "image/png", sizeBytes: 10, url: null, thumbnailUrl: null },
          ],
        },
        attachments,
      ),
    ).toBe("shot.png");

    expect(
      cellText({ kind: "relation", rowIds: ["r9"] }, relation, {
        relationLabels: new Map([["r9", "BUG-042"]]),
      }),
    ).toBe("BUG-042");
  });

  test("preserved text is detectable for the warning marker", () => {
    expect(hasUnparsedText({ kind: "date", iso: null, text: "soon" })).toBe(true);
    expect(hasUnparsedText({ kind: "text", value: "plain" })).toBe(false);
  });

  test("date-time formatting degrades on bad input", () => {
    expect(formatDateTime("2026-08-20T09:30:00.000Z")).toContain("09:30");
    expect(formatDateTime("nope")).toBe("—");
  });

  test("option lookup and colour cycling stay in range", () => {
    const options = [{ id: "o1", label: "A", color: "blue" as const }];

    expect(optionById(options, "o1")?.label).toBe("A");
    expect(optionById(options, "missing")).toBeUndefined();
    expect(SELECT_COLOR_CLASSES[nextOptionColor(options)]).toBeTruthy();
  });

  test("upsert adds a new column and replaces an existing one", () => {
    const first = makeColumn("c1", "One", "text", 0);
    const replaced = { ...first, name: "Renamed" };

    expect(upsertColumn([], first)).toHaveLength(1);
    expect(upsertColumn([first], replaced)[0]?.name).toBe("Renamed");
  });

  test("every column type and view type has a visual", () => {
    expect(columnVisual("relation").Icon).toBeTruthy();
    expect(VIEW_TYPE_LABELS.gantt).toBe("Gantt");
  });
});

/* ------------------------------------------------------ service endpoints */

describe("board service schema and collaboration endpoints", () => {
  async function board() {
    const snapshot = await boardService.getBoard(ID.roadmap);
    return snapshot.board;
  }

  test("columns can be added, renamed, reordered and deleted", async () => {
    const current = await board();

    const created = await boardService.createColumn(current.id, "text", "Notes");
    expect(created.name).toBe("Notes");

    const renamed = await boardService.updateColumn(current.id, created.id, { name: "Field notes" });
    expect(renamed.name).toBe("Field notes");

    const reordered = await boardFake.reorderColumn(current.id, created.id, 0);
    expect(reordered[0]?.id).toBe(created.id);

    const afterDelete = await boardService.deleteColumn(current.id, created.id);
    expect(afterDelete.some((column) => column.id === created.id)).toBe(false);
  });

  test("a view keeps its identity when patched", async () => {
    const current = await board();
    const view = current.views[0]!;

    const updated = await boardService.updateView(current.id, view.id, {
      name: "Renamed view",
      hiddenColumnIds: ["c_env"],
    } as Partial<SavedView>);

    expect(updated.id).toBe(view.id);
    expect(updated.name).toBe("Renamed view");
    expect(updated.hiddenColumnIds).toEqual(["c_env"]);
  });

  test("activity records the row's creation", async () => {
    const current = await board();
    const rowId = (await boardService.getBoard(ID.roadmap)).rows[0]!.id;

    const activity = await boardService.listActivity(current.id, rowId);
    expect(activity.some((entry) => entry.kind === "created")).toBe(true);
  });

  test("an unknown board or row is a not-found error", async () => {
    await expect(boardService.searchRows("brd_missing", "")).rejects.toThrow();
    const current = await board();
    await expect(boardService.deleteRow(current.id, "row_missing")).rejects.toThrow();
  });
});

/* --------------------------------------------------------- store commands */

describe("board store schema commands", () => {
  async function loaded() {
    await useBoardStore.getState().load(ID.roadmap);
    const board = useBoardStore.getState().board;
    if (!board) throw new Error("board did not load");
    return board;
  }

  test("adding a column appends it to the schema", async () => {
    await loaded();
    await useBoardStore.getState().addColumn("text", "Notes");

    expect(useBoardStore.getState().board?.columns.at(-1)?.name).toBe("Notes");
  });

  test("renaming is optimistic and survives a successful write", async () => {
    const board = await loaded();
    const columnId = board.columns[1]!.id;

    await useBoardStore.getState().renameColumn(columnId, "State");

    expect(
      useBoardStore.getState().board?.columns.find((column) => column.id === columnId)?.name,
    ).toBe("State");
  });

  test("a failed rename rolls the schema back", async () => {
    const board = await loaded();
    const columnId = board.columns[1]!.id;
    const before = board.columns[1]!.name;

    setSimulation({ failSaves: true });
    await useBoardStore.getState().renameColumn(columnId, "Broken");

    expect(
      useBoardStore.getState().board?.columns.find((column) => column.id === columnId)?.name,
    ).toBe(before);
  });

  test("converting a column reports how many values were preserved", async () => {
    const board = await loaded();
    const preserved = await useBoardStore.getState().convertColumn(board.primaryColumnId, "date");

    expect(preserved).toBeGreaterThan(0);
    expect(
      useBoardStore.getState().board?.columns.find((column) => column.id === board.primaryColumnId)
        ?.type,
    ).toBe("date");
  });

  test("deleting a column prunes it from every saved view", async () => {
    const board = await loaded();
    const columnId = board.columns[1]!.id;

    await useBoardStore.getState().setColumnHidden(columnId, true);
    await useBoardStore.getState().deleteColumn(columnId);

    const state = useBoardStore.getState();
    expect(state.board?.columns.some((column) => column.id === columnId)).toBe(false);
    expect(state.board?.views.every((view) => !view.hiddenColumnIds.includes(columnId))).toBe(true);
  });

  test("creating an option adds it to the column and returns it", async () => {
    const board = await loaded();
    const select = board.columns.find((column) => column.type === "select")!;

    const option = await useBoardStore.getState().createOption(select.id, "Deferred");
    const updated = useBoardStore
      .getState()
      .board?.columns.find((column) => column.id === select.id);

    expect(option?.label).toBe("Deferred");
    expect(updated?.type === "select" && updated.config.options.at(-1)?.id).toBe(option?.id);
  });

  test("sorting and reordering are stored on the view", async () => {
    const board = await loaded();
    const columnId = board.columns[1]!.id;

    await useBoardStore.getState().setSort(columnId, "desc");
    await useBoardStore.getState().moveColumnTo(columnId, 0);
    await useBoardStore.getState().commitColumnWidth(columnId, 240);

    const view = useBoardStore.getState().board?.views[0];
    expect(view?.sorts).toEqual([{ columnId, direction: "desc" }]);
    expect(view?.columnOrder[0]).toBe(columnId);
    expect(view?.columnWidths[columnId]).toBe(240);
  });

  test("search and view selection are plain state", async () => {
    const board = await loaded();

    useBoardStore.getState().setSearch("payment");
    useBoardStore.getState().setActiveView(board.views[1]!.id);

    expect(useBoardStore.getState().search).toBe("payment");
    expect(useBoardStore.getState().activeViewId).toBe(board.views[1]!.id);
  });

  test("a duplicate lands next to its source with a new identity", async () => {
    await loaded();
    const sourceId = useBoardStore.getState().rowOrder[0]!;

    const copyId = await useBoardStore.getState().duplicateRow(sourceId);
    const order = useBoardStore.getState().rowOrder;

    expect(order[1]).toBe(copyId);
    expect(useBoardStore.getState().rowsById[copyId ?? ""]?.displayId).toBe("TASK-005");
  });

  test("conflicts surface on the board and can be dismissed", async () => {
    const board = await loaded();
    const rowId = useBoardStore.getState().rowOrder[0]!;
    const columnId = board.primaryColumnId;

    // Push the server revision ahead of what the store believes.
    await boardService.updateCells({
      boardId: board.id,
      edits: [{ rowId, columnId, value: { kind: "text", value: "Elsewhere" } }],
    });

    await useBoardStore
      .getState()
      .editCells([{ rowId, columnId, value: { kind: "text", value: "Mine" } }]);

    const conflicts = useBoardStore.getState().conflicts;
    expect(conflicts).toHaveLength(1);

    useBoardStore.getState().dismissConflict(conflicts[0]!.id);
    expect(useBoardStore.getState().conflicts).toHaveLength(0);
  });

  test("a failed board load is reported, and reload retries it", async () => {
    setSimulation({ listFailure: "network" });
    await useBoardStore.getState().load(ID.roadmap);

    expect(useBoardStore.getState().status).toBe("error");

    resetSimulation();
    setSimulation({ latency: "fast" });
    await useBoardStore.getState().reload();

    expect(useBoardStore.getState().status).toBe("ready");
  });
});

/* ------------------------------------------------------------ guard rails */

describe("guards when no board is loaded", () => {
  beforeEach(() => {
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

  test("every command is a no-op instead of throwing", async () => {
    const store = useBoardStore.getState();

    await store.editCells([{ rowId: "r", columnId: "c", value: { kind: "text", value: "x" } }]);
    await store.editCells([]);
    expect(await store.addRow()).toBeNull();
    expect(await store.duplicateRow("missing")).toBeNull();
    await store.deleteRow("missing");
    await store.addColumn("text", "X");
    await store.updateColumnConfig("c", { name: "X" });
    expect(await store.convertColumn("c", "date")).toBe(0);
    await store.deleteColumn("c");
    expect(await store.createOption("c", "X")).toBeNull();
    await store.setSort("c", "asc");
    await store.setColumnHidden("c", true);
    await store.moveColumnTo("c", 0);
    await store.commitColumnWidth("c", 200);
    store.resizeColumn("c", 200);
    await store.reload();

    expect(useBoardStore.getState().board).toBeNull();
    expect(useBoardStore.getState().pendingWrites).toBe(0);
  });

  test("moving a column that is not in the view is ignored", async () => {
    await useBoardStore.getState().load(ID.roadmap);
    const before = useBoardStore.getState().board?.views[0]?.columnOrder;

    await useBoardStore.getState().moveColumnTo("col_missing", 0);

    expect(useBoardStore.getState().board?.views[0]?.columnOrder).toEqual(before);
  });
});
