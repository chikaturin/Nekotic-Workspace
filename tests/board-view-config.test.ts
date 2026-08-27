import { beforeEach, describe, expect, test } from "vitest";
import {
  addMonths,
  dayKey,
  dayOfMonth,
  isFirstOfMonth,
  shortDayLabel,
  startOfDay,
} from "@/lib/board-dates";
import { describeFilter, OPERATOR_LABELS } from "@/lib/board-filters";
import { matchesFilter, reorderViews } from "@/lib/board-view";
import { makeColumn } from "@/lib/board-schema";
import { MEMBERS } from "@/mock/users";
import { ServiceError } from "@/services/errors";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore, selectActiveView } from "@/store/board-store";
import { selectCollapsedGroups, useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumnOf, BoardRow, SavedView, WorkspaceRole } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

const WORKSPACE_ID = "ws_test";

async function load() {
  await useBoardStore.getState().load(ID.roadmap);
  const board = useBoardStore.getState().board;
  if (!board) throw new Error("board did not load");
  return board;
}

function activeView() {
  const view = selectActiveView(useBoardStore.getState());
  if (!view) throw new Error("no active view");
  return view;
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  boardService.reset();
  useGridStore.getState().reset();

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
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

describe("view configuration writes to the view, never the records", () => {
  test("filters, conjunction and sorts round-trip", async () => {
    const board = await load();
    const columnId = board.columns[1]!.id;
    const before = useBoardStore.getState().rowsById;

    await useBoardStore.getState().setFilters([
      { id: "f1", columnId, operator: "isNotEmpty", value: "" },
    ]);
    await useBoardStore.getState().setFilterConjunction("or");
    await useBoardStore.getState().setSorts([
      { columnId, direction: "desc" },
      { columnId: board.columns[2]!.id, direction: "asc" },
    ]);

    const view = activeView();
    expect(view.filters).toHaveLength(1);
    expect(view.filterConjunction).toBe("or");
    expect(view.sorts).toHaveLength(2);

    // Configuration cannot have touched a record.
    expect(useBoardStore.getState().rowsById).toBe(before);
  });

  test("grouping, dates, type and row height are all view state", async () => {
    const board = await load();

    await useBoardStore.getState().setGroupBy("col_status");
    await useBoardStore.getState().setHideEmptyGroups(true);
    await useBoardStore.getState().setDateColumn("col_due");
    await useBoardStore.getState().setEndDateColumn("col_start");
    await useBoardStore.getState().setViewType("gantt");
    await useBoardStore.getState().setRowHeight("tall");

    expect(activeView()).toMatchObject({
      groupByColumnId: "col_status",
      hideEmptyGroups: true,
      dateColumnId: "col_due",
      endDateColumnId: "col_start",
      type: "gantt",
      rowHeight: "tall",
    });
    expect(board.columns).toBe(board.columns);
  });

  test("a failed write rolls the view back to what it was", async () => {
    await load();
    const before = activeView();

    setSimulation({ failSaves: true });
    await useBoardStore.getState().setGroupBy("col_priority");

    expect(activeView().groupByColumnId).toBe(before.groupByColumnId);
  });

  test("a failed filter write leaves the previous conditions in place", async () => {
    await load();
    await useBoardStore.getState().setFilters([
      { id: "f1", columnId: "col_status", operator: "isNotEmpty", value: "" },
    ]);

    setSimulation({ failSaves: true });
    await useBoardStore.getState().setFilters([]);

    expect(activeView().filters).toHaveLength(1);
  });
});

describe("saved views", () => {
  test("creating a view adds it and makes it active", async () => {
    await load();
    const id = await useBoardStore.getState().createView("My tasks", "kanban");

    const state = useBoardStore.getState();
    expect(state.activeViewId).toBe(id);
    expect(state.board?.views.at(-1)).toMatchObject({ name: "My tasks", type: "kanban" });
  });

  test("duplicating copies the configuration, not the records", async () => {
    const board = await load();
    await useBoardStore.getState().setFilters([
      { id: "f1", columnId: "col_status", operator: "isNotEmpty", value: "" },
    ]);
    await useBoardStore.getState().setGroupBy("col_status");

    const rowsBefore = useBoardStore.getState().rowsById;
    const sourceId = activeView().id;
    const copyId = await useBoardStore.getState().duplicateView(sourceId);

    const copy = useBoardStore.getState().board?.views.find((view) => view.id === copyId);

    expect(copy?.id).not.toBe(sourceId);
    expect(copy?.name).toContain("copy");
    expect(copy?.filters).toHaveLength(1);
    expect(copy?.groupByColumnId).toBe("col_status");
    expect(useBoardStore.getState().rowsById).toBe(rowsBefore);
    expect(board.views.length).toBeLessThan(useBoardStore.getState().board!.views.length);
  });

  test("renaming is optimistic and rolls back when the write fails", async () => {
    await load();
    const viewId = activeView().id;

    await useBoardStore.getState().renameView(viewId, "Renamed");
    expect(activeView().name).toBe("Renamed");

    setSimulation({ failSaves: true });
    await useBoardStore.getState().renameView(viewId, "Broken");

    expect(activeView().name).toBe("Renamed");
  });

  test("deleting a view falls back to the first remaining one", async () => {
    const board = await load();
    const target = board.views[0]!.id;

    await useBoardStore.getState().deleteView(target);

    const state = useBoardStore.getState();
    expect(state.board?.views.some((view) => view.id === target)).toBe(false);
    expect(state.activeViewId).toBe(state.board?.views[0]?.id);
  });

  test("the last view cannot be deleted", async () => {
    const board = await load();
    for (const view of board.views.slice(1)) {
      await useBoardStore.getState().deleteView(view.id);
    }

    const remaining = useBoardStore.getState().board!.views;
    expect(remaining).toHaveLength(1);

    await useBoardStore.getState().deleteView(remaining[0]!.id);

    expect(useBoardStore.getState().board?.views).toHaveLength(1);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  test("view commands are no-ops before a board is loaded", async () => {
    const store = useBoardStore.getState();

    await store.setFilters([]);
    await store.setFilterConjunction("or");
    await store.setSorts([]);
    await store.setGroupBy(null);
    await store.setHideEmptyGroups(true);
    await store.setDateColumn(null);
    await store.setEndDateColumn(null);
    await store.setViewType("kanban");
    await store.setRowHeight("short");
    await store.renameView("v", "x");
    await store.deleteView("v");
    expect(await store.createView("x", "table")).toBeNull();
    expect(await store.duplicateView("v")).toBeNull();

    expect(useBoardStore.getState().board).toBeNull();
  });
});

/* ------------------------------------------------------------- tab order */

/**
 * Which tab comes first.
 *
 * The order is the board's rather than the reader's — a saved view is shared,
 * and so is where it sits — so moving one is a write that takes the same
 * permission as renaming or deleting it, and it has to survive a failed save
 * by going back where it was.
 */

/** Enough of a view to be reordered; nothing here reads the rest of it. */
const stub = (id: string): SavedView => ({ id, name: id }) as SavedView;

function signedInAs(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [
      {
        ...TEST_WORKSPACE,
        members: MEMBERS.map((member, index) => (index === 0 ? { ...member, role } : member)),
      },
    ],
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    feedback: null,
    seed: 0,
  });
}

describe("moving a view along the strip", () => {
  const ids = (views: readonly SavedView[]) => views.map((view) => view.id);
  const three = [stub("a"), stub("b"), stub("c")] as const;

  test("a view lands exactly where it was dropped", () => {
    expect(ids(reorderViews(three, "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(reorderViews(three, "a", 2))).toEqual(["b", "c", "a"]);
    expect(ids(reorderViews(three, "a", 1))).toEqual(["b", "a", "c"]);
  });

  /** Identity, not equality: it is what lets a caller skip the round trip. */
  test("a drop back where it started returns the same array", () => {
    expect(reorderViews(three, "b", 1)).toBe(three);
    expect(reorderViews(three, "missing", 0)).toBe(three);
  });

  test("a drop past either end means that end", () => {
    expect(ids(reorderViews(three, "a", 99))).toEqual(["b", "c", "a"]);
    expect(ids(reorderViews(three, "c", -5))).toEqual(["c", "a", "b"]);
  });

  test("nothing but the order changes — the views are the same objects", () => {
    const moved = reorderViews(three, "c", 0);
    expect(moved[0]).toBe(three[2]);
    expect(moved).toHaveLength(three.length);
  });

  test("the new order persists, so a reload opens on the same first tab", async () => {
    const board = await load();
    const last = board.views.at(-1)!.id;

    await useBoardStore.getState().moveViewTo(last, 0);
    expect(useBoardStore.getState().board?.views[0]?.id).toBe(last);

    await useBoardStore.getState().load(ID.roadmap);
    expect(useBoardStore.getState().board?.views[0]?.id).toBe(last);
  });

  test("switching tabs is untouched by the move — the active view stays active", async () => {
    const board = await load();
    const active = activeView().id;
    const last = board.views.at(-1)!.id;

    await useBoardStore.getState().moveViewTo(last, 0);

    expect(useBoardStore.getState().activeViewId).toBe(active);
    expect(activeView().id).toBe(active);
  });

  test("records are never touched by a reorder", async () => {
    const board = await load();
    const rowsBefore = useBoardStore.getState().rowsById;

    await useBoardStore.getState().moveViewTo(board.views.at(-1)!.id, 0);

    expect(useBoardStore.getState().rowsById).toBe(rowsBefore);
  });

  test("a failed save puts the tab back where it was", async () => {
    const board = await load();
    const before = board.views.map((view) => view.id);
    const last = before.at(-1)!;

    setSimulation({ failSaves: true });
    await useBoardStore.getState().moveViewTo(last, 0);

    expect(useBoardStore.getState().board?.views.map((view) => view.id)).toEqual(before);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  /**
   * A rename that lands while the move is in flight has to survive the
   * rollback. Undoing a move by restoring a snapshot of the array would take
   * the rename with it, which is the reason the rollback moves the view back
   * rather than putting the old array on.
   */
  test("rolling back a move does not undo an edit that landed beside it", async () => {
    const board = await load();
    const last = board.views.at(-1)!.id;
    const other = board.views[0]!.id;

    setSimulation({ failSaves: true });
    const inFlight = useBoardStore.getState().moveViewTo(last, 0);
    useBoardStore.setState((state) => ({
      board: state.board
        ? {
            ...state.board,
            views: state.board.views.map((view) =>
              view.id === other ? { ...view, name: "Renamed mid-flight" } : view,
            ),
          }
        : state.board,
    }));
    await inFlight;

    const views = useBoardStore.getState().board!.views;
    expect(views.map((view) => view.id)).toEqual(board.views.map((view) => view.id));
    expect(views.find((view) => view.id === other)?.name).toBe("Renamed mid-flight");
  });

  test("a member is refused by the service, not merely by the UI", async () => {
    const board = await load();
    const last = board.views.at(-1)!.id;

    signedInAs("member");
    await expect(boardService.reorderView(board.id, last, 0)).rejects.toBeInstanceOf(ServiceError);

    signedInAs("manager");
    await expect(boardService.reorderView(board.id, last, 0)).resolves.toBeDefined();
  });

  test("a drop back on the same tab writes nothing at all", async () => {
    const board = await load();
    const first = board.views[0]!.id;

    await useBoardStore.getState().moveViewTo(first, 0);

    // The board object itself is untouched, which is what tells us no write
    // was attempted rather than one that happened to land on the same order.
    expect(useBoardStore.getState().board).toBe(board);
  });

  test("moving before a board is loaded does nothing", async () => {
    await useBoardStore.getState().moveViewTo("v", 0);
    expect(useBoardStore.getState().board).toBeNull();
  });
});

describe("collapsed groups are per view", () => {
  test("toggling adds and removes a key", () => {
    const grid = useGridStore.getState();

    grid.toggleGroup("v1", "o_todo");
    expect(selectCollapsedGroups("v1")(useGridStore.getState())).toEqual(["o_todo"]);

    grid.toggleGroup("v1", "o_done");
    grid.toggleGroup("v1", "o_todo");
    expect(selectCollapsedGroups("v1")(useGridStore.getState())).toEqual(["o_done"]);
  });

  test("each view keeps its own collapse state", () => {
    const grid = useGridStore.getState();

    grid.setCollapsedGroups("v1", ["a", "b"]);
    grid.setCollapsedGroups("v2", []);

    expect(selectCollapsedGroups("v1")(useGridStore.getState())).toEqual(["a", "b"]);
    expect(selectCollapsedGroups("v2")(useGridStore.getState())).toEqual([]);
    expect(selectCollapsedGroups(null)(useGridStore.getState())).toEqual([]);
  });
});

describe("edges", () => {
  const relation: BoardColumnOf<"relation"> = {
    ...makeColumn("c_rel", "Blocked by", "relation", 0),
    type: "relation",
    config: { boardId: null, displayColumnId: null, isMulti: true },
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

  test("relation conditions match by id and by label", () => {
    const value = row({ c_rel: { kind: "relation", rowIds: ["row_9"] } });
    const context = { relationLabels: new Map([["row_9", "BUG-042"]]) };

    expect(
      matchesFilter(value, { id: "f", columnId: "c_rel", operator: "contains", value: "BUG" }, relation, context),
    ).toBe(true);
    expect(
      matchesFilter(value, { id: "f", columnId: "c_rel", operator: "is", value: "row_9" }, relation, context),
    ).toBe(true);
  });

  test("an operator a type does not support passes everything through", () => {
    const value = row({ c_rel: { kind: "relation", rowIds: ["row_9"] } });

    expect(
      matchesFilter(value, { id: "f", columnId: "c_rel", operator: "before", value: "x" }, relation, {}),
    ).toBe(true);
  });

  test("a condition with no value still describes itself", () => {
    expect(describeFilter({ id: "f", columnId: "c_rel", operator: "isEmpty", value: "" }, [relation])).toBe(
      "Blocked by is empty",
    );
    expect(describeFilter({ id: "f", columnId: "gone", operator: "is", value: "" }, [])).toContain("is");
    expect(OPERATOR_LABELS.onOrAfter).toBe("is on or after");
  });

  test("date helpers cope with junk and month edges", () => {
    expect(dayKey("not-a-date")).toBeNull();
    expect(startOfDay("not-a-date")).toBe("not-a-date");
    expect(addMonths("2026-12-15T00:00:00.000Z", 1)).toBe("2027-01-01T00:00:00.000Z");
    expect(isFirstOfMonth("2026-08-01T00:00:00.000Z")).toBe(true);
    expect(dayOfMonth("2026-08-20T00:00:00.000Z")).toBe(20);
    expect(shortDayLabel("2026-08-20T00:00:00.000Z")).toBe("20 Aug");
  });
});
