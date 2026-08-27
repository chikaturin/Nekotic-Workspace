import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildGanttLinks,
  buildGanttRows,
  relationColumnsOf,
  spanDays,
  type GanttRow,
} from "@/lib/board-gantt";
import { buildHierarchy, layoutHierarchy } from "@/lib/board-hierarchy";
import type { RowMap } from "@/lib/board-records";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumn, BoardColumnOf, BoardRow } from "@/types";
import { buildTestTree, ID } from "./helpers";

/**
 * Gantt.
 *
 * The property under test throughout: the chart owns no data. Every bar is a
 * board record read through the same hierarchy the table nests with, and every
 * drag is an ordinary cell edit — so nothing here can drift from the grid.
 */

const WORKSPACE_ID = "ws_test";
const START = "col_start";
const END = "col_end";
const BLOCKS = "col_blocks";
const RANGE_START = "2026-08-24T00:00:00.000Z";

function day(iso: string): string {
  return `${iso}T00:00:00.000Z`;
}

function row(
  id: string,
  options: {
    start?: string | null;
    end?: string | null;
    parentRowId?: string | null;
    blockedBy?: readonly string[];
  } = {},
): BoardRow {
  return {
    id,
    boardId: "brd",
    displayId: id.toUpperCase(),
    sequence: 1,
    cells: {
      ...(options.start !== undefined
        ? { [START]: { kind: "date" as const, iso: options.start } }
        : {}),
      ...(options.end !== undefined ? { [END]: { kind: "date" as const, iso: options.end } } : {}),
      ...(options.blockedBy
        ? { [BLOCKS]: { kind: "relation" as const, rowIds: [...options.blockedBy] } }
        : {}),
    },
    createdAt: RANGE_START,
    updatedAt: RANGE_START,
    createdBy: "u1",
    revision: 1,
    ...(options.parentRowId !== undefined ? { parentRowId: options.parentRowId } : {}),
  };
}

function dateColumn(id: string, name: string): BoardColumn {
  return {
    id,
    name,
    position: 1,
    width: 150,
    hidden: false,
    isPrimary: false,
    type: "date",
    config: { includesTime: false },
  };
}

const START_COLUMN = dateColumn(START, "Start date");
const END_COLUMN = dateColumn(END, "Due date");

const RELATION_COLUMN: BoardColumn = {
  id: BLOCKS,
  name: "Blocked by",
  position: 2,
  width: 180,
  hidden: false,
  isPrimary: false,
  type: "relation",
  config: { boardId: null, displayColumnId: null, isMulti: true },
};

function build(rows: readonly BoardRow[], completionColumn: BoardColumnOf<"select"> | null = null) {
  const rowsById: RowMap = Object.fromEntries(rows.map((record) => [record.id, record]));
  const rowIds = rows.map((record) => record.id);
  const index = buildHierarchy(rowIds, rowsById);

  const entries = layoutHierarchy({
    rowIds,
    rowsById,
    index,
    display: "nested",
    collapsed: new Set(),
  });

  return {
    rowsById,
    index,
    ...buildGanttRows({
      entries,
      rowsById,
      index,
      startColumn: START_COLUMN,
      endColumn: END_COLUMN,
      completionColumn,
      rangeStartIso: RANGE_START,
    }),
  };
}

function find(rows: readonly GanttRow[], id: string): GanttRow {
  const found = rows.find((candidate) => candidate.rowId === id);
  if (!found) throw new Error(`${id} is not on the chart`);
  return found;
}

/* -------------------------------------------------------------------- bars */

describe("placing records on the chart", () => {
  test("a record with both dates spans them, both ends included", () => {
    const { scheduled } = build([row("a", { start: day("2026-08-26"), end: day("2026-08-29") })]);
    const bar = find(scheduled, "a");

    expect(bar.schedule?.offset).toBe(2);
    expect(bar.schedule?.span).toBe(4);
    expect(bar.kind).toBe("task");
  });

  test("a timestamp is read as the day it falls in — no bar starts at 13:37", () => {
    const { scheduled } = build([
      row("a", { start: "2026-08-26T13:37:00.000Z", end: "2026-08-27T21:05:00.000Z" }),
    ]);

    expect(find(scheduled, "a").schedule?.startIso).toBe(day("2026-08-26"));
    expect(find(scheduled, "a").schedule?.span).toBe(2);
  });

  /**
   * A one-day task is a task, not a milestone. Rendering it as a marker is how
   * a Gantt stops showing duration, so it gets a bar exactly one day wide.
   */
  test("a single-day record is a one-day bar, never a zero-width one", () => {
    const { scheduled } = build([row("a", { start: day("2026-08-26"), end: day("2026-08-26") })]);

    expect(find(scheduled, "a").kind).toBe("task");
    expect(find(scheduled, "a").schedule?.span).toBe(1);
  });

  /**
   * One date is not a duration. Inventing the other end would make every such
   * record look identical to a real one-day task.
   */
  test("only one date set is an incomplete schedule, not a one-day bar", () => {
    const onlyStart = build([row("a", { start: day("2026-08-26"), end: null })]);
    expect(onlyStart.scheduled).toHaveLength(0);
    expect(find(onlyStart.unscheduled, "a").gap).toBe("partial");

    const onlyEnd = build([row("b", { start: null, end: day("2026-08-26") })]);
    expect(onlyEnd.scheduled).toHaveLength(0);
    expect(find(onlyEnd.unscheduled, "b").gap).toBe("partial");
  });

  test("nothing on the chart is a milestone by inference", () => {
    const { scheduled } = build([
      row("a", { start: day("2026-08-26"), end: day("2026-08-26") }),
      row("b", { start: day("2026-08-26"), end: day("2026-09-02") }),
    ]);

    expect(scheduled.map((entry) => entry.kind)).toEqual(["task", "task"]);
  });

  /** A chart that quietly omits part of the board misrepresents the board. */
  test("a record with no dates is listed as unscheduled, never dropped", () => {
    const { scheduled, unscheduled } = build([row("a", { start: null, end: null })]);

    expect(scheduled).toHaveLength(0);
    expect(unscheduled.map((entry) => entry.rowId)).toEqual(["a"]);
    expect(find(unscheduled, "a").gap).toBe("none");
  });

  /**
   * A start after its end is a mistake in the data. Swapping it would hide the
   * error and rewrite what the user typed, so it is reported instead.
   */
  test("a start after its end draws no bar and is reported, not reordered", () => {
    const { scheduled, unscheduled } = build([
      row("a", { start: day("2026-08-29"), end: day("2026-08-26") }),
    ]);

    expect(scheduled).toHaveLength(0);
    expect(find(unscheduled, "a").gap).toBe("inverted");
    // The record itself is untouched — nothing was written to fix it.
    expect(find(unscheduled, "a").schedule).toBeNull();
  });
});

/* -------------------------------------------------------------- hierarchy */

describe("parents and subtasks", () => {
  test("a parent with no dates of its own spans its subtasks", () => {
    const { scheduled } = build([
      row("parent", { start: null, end: null }),
      row("a", { start: day("2026-08-26"), end: day("2026-08-28"), parentRowId: "parent" }),
      row("b", { start: day("2026-08-27"), end: day("2026-08-31"), parentRowId: "parent" }),
    ]);

    const summary = find(scheduled, "parent");
    expect(summary.kind).toBe("summary");
    expect(summary.isDerived).toBe(true);
    expect(summary.schedule?.startIso).toBe(day("2026-08-26"));
    expect(summary.schedule?.endIso).toBe(day("2026-08-31"));
  });

  test("the summary reaches through grandchildren, not just direct children", () => {
    const { scheduled } = build([
      row("parent", { start: null, end: null }),
      row("child", { start: null, end: null, parentRowId: "parent" }),
      row("grandchild", {
        start: day("2026-09-10"),
        end: day("2026-09-12"),
        parentRowId: "child",
      }),
    ]);

    expect(find(scheduled, "parent").schedule?.endIso).toBe(day("2026-09-12"));
  });

  test("a parent with its own dates keeps them, and stays editable", () => {
    const { scheduled } = build([
      row("parent", { start: day("2026-08-01"), end: day("2026-08-02") }),
      row("a", { start: day("2026-08-26"), end: day("2026-08-28"), parentRowId: "parent" }),
    ]);

    const parent = find(scheduled, "parent");
    expect(parent.isDerived).toBe(false);
    expect(parent.schedule?.startIso).toBe(day("2026-08-01"));
  });

  test("a childless record with no dates never becomes a summary", () => {
    const { scheduled, unscheduled } = build([row("a", { start: null, end: null })]);

    expect(scheduled).toHaveLength(0);
    expect(find(unscheduled, "a").isDerived).toBe(false);
  });

  test("depth comes from the shared hierarchy, so the chart nests like the table", () => {
    const { scheduled } = build([
      row("parent", { start: day("2026-08-25"), end: day("2026-08-30") }),
      row("a", { start: day("2026-08-26"), end: day("2026-08-28"), parentRowId: "parent" }),
    ]);

    expect(find(scheduled, "parent").depth).toBe(0);
    expect(find(scheduled, "a").depth).toBe(1);
    expect(find(scheduled, "parent").hasChildren).toBe(true);
  });
});

/* ------------------------------------------------------------ dependencies */

describe("blocked by", () => {
  const rows = [
    row("a", { start: day("2026-08-26"), end: day("2026-08-30") }),
    row("b", { start: day("2026-09-01"), end: day("2026-09-04"), blockedBy: ["a"] }),
  ];

  test("a link runs from the blocker to the record that names it", () => {
    const { scheduled, rowsById } = build(rows);
    const links = buildGanttLinks(scheduled, rowsById, [RELATION_COLUMN]);

    expect(links).toHaveLength(1);
    expect(links[0]?.fromRowId).toBe("a");
    expect(links[0]?.toRowId).toBe("b");
    expect(links[0]?.isConflict).toBe(false);
  });

  /** The warning is the whole feature: the chart never reschedules anyone. */
  test("a record starting before its blocker ends is a conflict, and is left alone", () => {
    const conflicting = [
      row("a", { start: day("2026-08-26"), end: day("2026-08-30") }),
      row("b", { start: day("2026-08-28"), end: day("2026-09-01"), blockedBy: ["a"] }),
    ];

    const { scheduled, rowsById } = build(conflicting);
    const links = buildGanttLinks(scheduled, rowsById, [RELATION_COLUMN]);

    expect(links[0]?.isConflict).toBe(true);
    // The dates are exactly what the record said they were.
    expect(find(scheduled, "b").schedule?.startIso).toBe(day("2026-08-28"));
  });

  test("a dependency on a record this view filtered out is not drawn into space", () => {
    const { rowsById } = build(rows);
    const onlyB = build([rows[1] as BoardRow]);

    expect(buildGanttLinks(onlyB.scheduled, rowsById, [RELATION_COLUMN])).toEqual([]);
  });

  test("a record cannot block itself", () => {
    const selfish = [row("a", { start: day("2026-08-26"), end: day("2026-08-30"), blockedBy: ["a"] })];
    const { scheduled, rowsById } = build(selfish);

    expect(buildGanttLinks(scheduled, rowsById, [RELATION_COLUMN])).toEqual([]);
  });

  test("a board with no relation column has no dependencies to draw", () => {
    const { scheduled, rowsById } = build(rows);

    expect(relationColumnsOf([START_COLUMN, END_COLUMN])).toEqual([]);
    expect(buildGanttLinks(scheduled, rowsById, [START_COLUMN, END_COLUMN])).toEqual([]);
  });

  /**
   * Containment and dependency are different questions. A parent/child pair is
   * not a link, and a link is not a nesting.
   */
  test("subtasks are not dependencies", () => {
    const nested = [
      row("parent", { start: day("2026-08-25"), end: day("2026-08-30") }),
      row("child", { start: day("2026-08-26"), end: day("2026-08-28"), parentRowId: "parent" }),
    ];

    const { scheduled, rowsById } = build(nested);
    expect(buildGanttLinks(scheduled, rowsById, [RELATION_COLUMN])).toEqual([]);
    expect(find(scheduled, "child").depth).toBe(1);
  });
});

/* ---------------------------------------------------------------- geometry */

describe("bar geometry", () => {
  test("a range covers both of its end days", () => {
    expect(spanDays(day("2026-08-27"), day("2026-08-27"))).toBe(1);
    expect(spanDays(day("2026-08-27"), day("2026-09-03"))).toBe(8);
  });

  test("offset and span are whole days from the range start", () => {
    const { scheduled } = build([row("a", { start: day("2026-08-27"), end: day("2026-09-03") })]);
    const schedule = find(scheduled, "a").schedule;

    // RANGE_START is 24 Aug, so 27 Aug is three days in and runs eight days.
    expect(schedule?.offset).toBe(3);
    expect(schedule?.span).toBe(8);
  });
});

/* ------------------------------------------------------------- integration */

describe("the chart writes through the board", () => {
  beforeEach(async () => {
    resetSimulation();
    setSimulation({ latency: "fast" });
    boardService.reset();

    useWorkspaceStore.setState({
      activeWorkspaceId: WORKSPACE_ID,
      treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
      feedback: null,
      seed: 0,
    });

    await useBoardStore.getState().load(ID.roadmap);
  });

  function firstRow(): BoardRow {
    const state = useBoardStore.getState();
    const id = state.rowOrder[0];
    const record = id ? state.rowsById[id] : undefined;
    if (!record) throw new Error("board did not load");
    return record;
  }

  /** Moving a bar is a cell edit, so the table has the new dates too. */
  test("a date edited on the record is what lengthens its bar", async () => {
    const record = firstRow();
    const columns = useBoardStore.getState().board?.columns ?? [];
    const start = columns.find((column) => column.type === "date");
    const end = columns.filter((column) => column.type === "date")[1];
    if (!start || !end) throw new Error("the task template lost its date columns");

    await useBoardStore.getState().editCells([
      { rowId: record.id, columnId: start.id, value: { kind: "date", iso: day("2026-08-26") } },
      { rowId: record.id, columnId: end.id, value: { kind: "date", iso: day("2026-08-29") } },
    ]);

    // Editing the record — from the drawer, the grid, anywhere — is what moves
    // a bar. The chart re-reads the same cells and redraws.
    await useBoardStore.getState().editCells([
      { rowId: record.id, columnId: end.id, value: { kind: "date", iso: day("2026-09-06") } },
    ]);

    const after = useBoardStore.getState().rowsById[record.id];
    expect(after?.cells[start.id]).toEqual({ kind: "date", iso: day("2026-08-26") });
    expect(after?.cells[end.id]).toEqual({ kind: "date", iso: day("2026-09-06") });
    expect(spanDays(day("2026-08-26"), day("2026-09-06"))).toBe(12);
  });

  test("a date the service rejects rolls back to what it was", async () => {
    const record = firstRow();
    const columns = useBoardStore.getState().board?.columns ?? [];
    const start = columns.find((column) => column.type === "date");
    if (!start) throw new Error("the task template lost its date columns");

    await useBoardStore.getState().editCells([
      { rowId: record.id, columnId: start.id, value: { kind: "date", iso: day("2026-08-26") } },
    ]);

    const before = useBoardStore.getState().rowsById[record.id]?.cells[start.id];

    const failing = vi
      .spyOn(boardService, "updateCells")
      .mockRejectedValue(new Error("the server said no"));

    try {
      await useBoardStore.getState().editCells([
        { rowId: record.id, columnId: start.id, value: { kind: "date", iso: day("2026-09-09") } },
      ]);
    } finally {
      failing.mockRestore();
    }

    expect(useBoardStore.getState().rowsById[record.id]?.cells[start.id]).toEqual(before);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  /**
   * Transition rules govern Status. Dragging a bar changes dates, and must not
   * be gated by a workflow the user wrote about something else.
   */
  test("a status transition rule does not gate a date change", async () => {
    const record = firstRow();
    const columns = useBoardStore.getState().board?.columns ?? [];
    const start = columns.find((column) => column.type === "date");
    if (!start) throw new Error("the task template lost its date columns");

    await useBoardStore.getState().updateColumnConfig("col_status", {
      config: {
        transitionRules: { enabled: true, mode: "allow-list", transitions: { status_0: [] } },
      },
    });

    await useBoardStore.getState().editCells([
      { rowId: record.id, columnId: start.id, value: { kind: "date", iso: day("2026-09-15") } },
    ]);

    expect(useBoardStore.getState().rowsById[record.id]?.cells[start.id]).toEqual({
      kind: "date",
      iso: day("2026-09-15"),
    });
  });
});
