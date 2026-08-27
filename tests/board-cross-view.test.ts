import { beforeEach, describe, expect, test } from "vitest";
import { buildMonth, moveToDay } from "@/lib/board-calendar";
import { buildGroups, groupKeyOf, groupValueFor } from "@/lib/board-grouping";
import { buildBars, timelineScale } from "@/lib/board-timeline";
import { queryRowIds } from "@/lib/board-view";
import { cellOf } from "@/lib/cell-values";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Board, BoardColumn, BoardColumnOf, SavedView } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * Cross-view integration.
 *
 * Every scenario writes through one view's interaction and reads back through
 * another view's projection. Nothing here mocks a view model: they all run the
 * same board records, which is the property being tested.
 */

const WORKSPACE_ID = "ws_test";

interface Harness {
  readonly board: Board;
  readonly rowId: string;
  readonly status: BoardColumnOf<"select">;
  readonly due: BoardColumnOf<"date">;
  readonly start: BoardColumnOf<"date">;
  readonly view: SavedView;
}

function columnOf<T extends BoardColumn["type"]>(
  board: Board,
  id: string,
  type: T,
): Extract<BoardColumn, { type: T }> {
  const column = board.columns.find((candidate) => candidate.id === id);
  if (!column || column.type !== type) throw new Error(`fixture is missing ${id}`);
  return column as Extract<BoardColumn, { type: T }>;
}

async function load(): Promise<Harness> {
  await useBoardStore.getState().load(ID.roadmap);
  const state = useBoardStore.getState();
  const board = state.board;
  const rowId = state.rowOrder[0];
  if (!board || !rowId) throw new Error("board did not load");

  return {
    board,
    rowId,
    status: columnOf(board, "col_status", "select"),
    due: columnOf(board, "col_due", "date"),
    start: columnOf(board, "col_start", "date"),
    view: board.views[0]!,
  };
}

/** The projection each view builds from the current records. */
function projections(harness: Harness) {
  const state = useBoardStore.getState();
  const context = { people: new Map(state.people.map((person) => [person.id, person])) };

  const rowIds = queryRowIds({
    view: harness.view,
    rowsById: state.rowsById,
    rowOrder: state.rowOrder,
    columns: state.board?.columns ?? [],
    context,
  });

  return {
    rowIds,
    rowsById: state.rowsById,
    context,
    kanban: () => buildGroups(rowIds, state.rowsById, harness.status, context),
    calendar: (monthIso: string) =>
      buildMonth(monthIso, rowIds, state.rowsById, harness.due, "2026-08-26T00:00:00.000Z"),
    timeline: () => {
      const scale = timelineScale(
        rowIds,
        state.rowsById,
        harness.start,
        harness.due,
        "day",
        "2026-08-26T00:00:00.000Z",
      );
      return { scale, bars: buildBars(rowIds, state.rowsById, harness.start, harness.due, scale.startIso) };
    },
  };
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  boardService.reset();

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

describe("one record set behind every view", () => {
  test("1 · editing Status in the table moves the card in Kanban", async () => {
    const harness = await load();
    const before = projections(harness);

    const from = before.kanban().find((group) => group.rowIds.includes(harness.rowId));
    expect(from).toBeDefined();

    const target = harness.status.config.options.find((option) => option.id !== from?.key);
    if (!target) throw new Error("fixture needs two options");

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.status.id, value: { kind: "select", optionIds: [target.id] } },
    ]);

    const after = projections(harness);
    const to = after.kanban().find((group) => group.rowIds.includes(harness.rowId));

    expect(to?.key).toBe(target.id);
    expect(from?.key).not.toBe(to?.key);
  });

  test("2 · dropping a card in Kanban rewrites the cell the table shows", async () => {
    const harness = await load();
    const done = harness.status.config.options.at(-1)!;

    // Exactly what the Kanban drop handler does.
    const value = groupValueFor(harness.status, done.id);
    expect(value).not.toBeNull();

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.status.id, value: value! },
    ]);

    const row = useBoardStore.getState().rowsById[harness.rowId]!;

    expect(cellOf(row, harness.status)).toEqual({ kind: "select", optionIds: [done.id] });
    expect(groupKeyOf(harness.rowId, useBoardStore.getState().rowsById, harness.status)).toBe(done.id);
  });

  test("3 · changing a Due date moves the record to another calendar day", async () => {
    const harness = await load();
    const monthIso = "2026-08-01T00:00:00.000Z";

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: "2026-08-11T00:00:00.000Z" } },
    ]);

    const first = projections(harness).calendar(monthIso);
    expect(dayHolding(first, harness.rowId)).toBe("2026-08-11");

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: "2026-08-19T00:00:00.000Z" } },
    ]);

    const second = projections(harness).calendar(monthIso);
    expect(dayHolding(second, harness.rowId)).toBe("2026-08-19");
  });

  test("3b · clearing the date sends the record to Unscheduled", async () => {
    const harness = await load();

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: null } },
    ]);

    const month = projections(harness).calendar("2026-08-01T00:00:00.000Z");

    expect(month.unscheduled).toContain(harness.rowId);
    expect(dayHolding(month, harness.rowId)).toBeNull();
  });

  test("4 · dragging an event in the calendar rewrites the cell the table shows", async () => {
    const harness = await load();

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: "2026-08-11T09:30:00.000Z" } },
    ]);

    // Exactly what the calendar drop handler does.
    const current = cellOf(useBoardStore.getState().rowsById[harness.rowId]!, harness.due);
    const iso = moveToDay(current.kind === "date" ? current.iso : null, "2026-08-25T00:00:00.000Z");

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso } },
    ]);

    const row = useBoardStore.getState().rowsById[harness.rowId]!;
    const cell = cellOf(row, harness.due);

    // The table sees the new day, and the time of day survived the drag.
    expect(cell.kind === "date" && cell.iso).toBe("2026-08-25T09:30:00.000Z");
    expect(dayHolding(projections(harness).calendar("2026-08-01T00:00:00.000Z"), harness.rowId)).toBe(
      "2026-08-25",
    );
  });

  test("5 · editing Start and End redraws the timeline bar", async () => {
    const harness = await load();

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.start.id, value: { kind: "date", iso: "2026-08-10T00:00:00.000Z" } },
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: "2026-08-14T00:00:00.000Z" } },
    ]);

    const first = projections(harness).timeline();
    const before = first.bars.find((bar) => bar.rowId === harness.rowId);
    expect(before?.span).toBe(5);

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: "2026-08-20T00:00:00.000Z" } },
    ]);

    const second = projections(harness).timeline();
    const after = second.bars.find((bar) => bar.rowId === harness.rowId);

    expect(after?.span).toBe(11);
    expect(after?.startIso).toBe("2026-08-10T00:00:00.000Z");
  });

  test("a filter applies to all four views at once", async () => {
    const harness = await load();
    const done = harness.status.config.options.at(-1)!;

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.status.id, value: { kind: "select", optionIds: [done.id] } },
      { rowId: harness.rowId, columnId: harness.due.id, value: { kind: "date", iso: "2026-08-11T00:00:00.000Z" } },
      { rowId: harness.rowId, columnId: harness.start.id, value: { kind: "date", iso: "2026-08-10T00:00:00.000Z" } },
    ]);

    await useBoardStore.getState().setFilters([
      { id: "f", columnId: harness.status.id, operator: "isNot", value: done.id },
    ]);

    const view = useBoardStore.getState().board!.views[0]!;
    const filtered = projections({ ...harness, view });

    expect(filtered.rowIds).not.toContain(harness.rowId);
    expect(filtered.kanban().every((group) => !group.rowIds.includes(harness.rowId))).toBe(true);
    expect(dayHolding(filtered.calendar("2026-08-01T00:00:00.000Z"), harness.rowId)).toBeNull();
    expect(filtered.timeline().bars.some((bar) => bar.rowId === harness.rowId)).toBe(false);
  });

  test("a rejected Kanban drop leaves the card where it was", async () => {
    const harness = await load();
    const before = groupKeyOf(harness.rowId, useBoardStore.getState().rowsById, harness.status);
    const target = harness.status.config.options.find((option) => option.id !== before)!;

    setSimulation({ failSaves: true });

    await useBoardStore.getState().editCells([
      { rowId: harness.rowId, columnId: harness.status.id, value: groupValueFor(harness.status, target.id)! },
    ]);

    const after = groupKeyOf(harness.rowId, useBoardStore.getState().rowsById, harness.status);

    expect(after).toBe(before);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  test("switching a saved view changes the reading, not the records", async () => {
    const harness = await load();
    const before = useBoardStore.getState().rowsById;
    const kanbanView = harness.board.views.find((view) => view.type === "kanban");
    if (!kanbanView) throw new Error("fixture needs a kanban view");

    useBoardStore.getState().setActiveView(kanbanView.id);

    // Same object identity: switching views cannot have copied anything.
    expect(useBoardStore.getState().rowsById).toBe(before);
    expect(useBoardStore.getState().activeViewId).toBe(kanbanView.id);
  });
});

function dayHolding(
  month: ReturnType<ReturnType<typeof projections>["calendar"]>,
  rowId: string,
): string | null {
  return month.weeks.flat().find((day) => day.rowIds.includes(rowId))?.key ?? null;
}
