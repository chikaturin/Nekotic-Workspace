import { describe, expect, test } from "vitest";
import { buildMonth, bucketByDay, moveToDay, shiftMonth } from "@/lib/board-calendar";
import {
  addDays,
  dayIndex,
  dayKey,
  daysBetween,
  isSameDay,
  monthLabel,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
} from "@/lib/board-dates";
import {
  makeFilter,
  operatorsFor,
  reconcileOperator,
  describeFilter,
  valueKindFor,
} from "@/lib/board-filters";
import {
  buildGroups,
  bucketsFor,
  flattenGroups,
  flattenUngrouped,
  groupKeyOf,
  groupValueFor,
  UNGROUPED_KEY,
} from "@/lib/board-grouping";
import { indexRows } from "@/lib/board-records";
import { makeColumn } from "@/lib/board-schema";
import {
  buildBars,
  DAY_WIDTH,
  offsetToIso,
  orderRange,
  timelineScale,
  TIMELINE_ZOOMS,
} from "@/lib/board-timeline";
import { queryRowIds, pruneView } from "@/lib/board-view";
import type { BoardColumn, BoardColumnOf, BoardRow, DirectoryUser, SavedView } from "@/types";

/* --------------------------------------------------------------- fixtures */

const title = makeColumn("c_title", "Title", "text", 0, { isPrimary: true });

const status: BoardColumnOf<"select"> = {
  ...makeColumn("c_status", "Status", "select", 1),
  type: "select",
  config: {
    isMulti: false,
    options: [
      { id: "o_todo", label: "To do", color: "gray" },
      { id: "o_doing", label: "Doing", color: "blue" },
      { id: "o_done", label: "Done", color: "green" },
    ],
  },
};

const due: BoardColumnOf<"date"> = {
  ...makeColumn("c_due", "Due", "date", 2),
  type: "date",
  config: { includesTime: false },
};

const start: BoardColumnOf<"date"> = {
  ...makeColumn("c_start", "Start", "date", 3),
  type: "date",
  config: { includesTime: false },
};

const owner: BoardColumnOf<"user"> = {
  ...makeColumn("c_owner", "Owner", "user", 4),
  type: "user",
  config: { isMulti: false },
};

const COLUMNS: readonly BoardColumn[] = [title, status, due, start, owner];

const PEOPLE: readonly DirectoryUser[] = [
  { id: "u1", name: "Mai Tran", email: "mai@nexdrop.io", initials: "MT", isActive: true },
  { id: "u2", name: "Thanh Bui", email: "thanh@nexdrop.io", initials: "TB", isActive: false },
];

const CONTEXT = { people: new Map(PEOPLE.map((person) => [person.id, person])) };

function makeRow(id: string, cells: Partial<BoardRow["cells"]> = {}): BoardRow {
  return {
    id,
    boardId: "b1",
    displayId: `TASK-00${id.slice(-1)}`,
    sequence: 1,
    cells: {
      c_title: { kind: "text", value: `Row ${id}` },
      c_status: { kind: "select", optionIds: ["o_todo"] },
      c_due: { kind: "date", iso: null },
      c_start: { kind: "date", iso: null },
      c_owner: { kind: "user", userIds: [] },
      ...cells,
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "u1",
    revision: 1,
  };
}

const VIEW: SavedView = {
  id: "v1",
  boardId: "b1",
  name: "All",
  type: "table",
  filters: [],
  filterConjunction: "and",
  sorts: [],
  hiddenColumnIds: [],
  columnOrder: [],
  columnWidths: {},
  rowHeight: "medium",
  groupByColumnId: null,
  hideEmptyGroups: false,
  dateColumnId: null,
  endDateColumnId: null,
};

/* ------------------------------------------------------------ date helpers */

describe("date helpers", () => {
  test("days are UTC and arithmetic round-trips", () => {
    expect(dayKey("2026-08-20T15:30:00.000Z")).toBe("2026-08-20");
    expect(dayKey(null)).toBeNull();
    expect(addDays("2026-08-20T00:00:00.000Z", 5)).toBe("2026-08-25T00:00:00.000Z");
    expect(daysBetween("2026-08-20T00:00:00.000Z", "2026-08-25T00:00:00.000Z")).toBe(5);
    expect(isSameDay("2026-08-20T01:00:00.000Z", "2026-08-20T23:00:00.000Z")).toBe(true);
  });

  test("weeks start on Monday", () => {
    // 2026-08-20 is a Thursday.
    expect(weekdayIndex("2026-08-20T00:00:00.000Z")).toBe(3);
    expect(startOfWeek("2026-08-20T00:00:00.000Z")).toBe("2026-08-17T00:00:00.000Z");
  });

  test("month boundaries and labels", () => {
    expect(startOfMonth("2026-08-20T00:00:00.000Z")).toBe("2026-08-01T00:00:00.000Z");
    expect(monthLabel("2026-08-20T00:00:00.000Z")).toBe("Aug 2026");
    expect(dayIndex("1970-01-02T00:00:00.000Z")).toBe(1);
  });
});

/* --------------------------------------------------------------- grouping */

describe("grouping", () => {
  const rows = [
    makeRow("r1", { c_status: { kind: "select", optionIds: ["o_doing"] } }),
    makeRow("r2", { c_status: { kind: "select", optionIds: ["o_done"] } }),
    makeRow("r3", { c_status: { kind: "select", optionIds: [] } }),
    makeRow("r4", { c_status: { kind: "select", optionIds: ["o_doing"] } }),
  ];
  const index = indexRows(rows);
  const rowIds = ["r1", "r2", "r3", "r4"];

  test("groups follow the option order, not the record order", () => {
    const groups = buildGroups(rowIds, index.rowsById, status, CONTEXT);

    expect(groups.map((group) => group.key)).toEqual([
      "o_todo",
      "o_doing",
      "o_done",
      UNGROUPED_KEY,
    ]);
    expect(groups[1]?.rowIds).toEqual(["r1", "r4"]);
    expect(groups[3]?.rowIds).toEqual(["r3"]);
  });

  test("empty buckets can be kept for Kanban or dropped for the table", () => {
    const kept = buildGroups(rowIds, index.rowsById, status, CONTEXT);
    const dropped = buildGroups(rowIds, index.rowsById, status, CONTEXT, { hideEmpty: true });

    expect(kept.find((group) => group.key === "o_todo")?.rowIds).toEqual([]);
    expect(dropped.map((group) => group.key)).toEqual(["o_doing", "o_done", UNGROUPED_KEY]);
  });

  test("a user column groups by person, including inactive ones", () => {
    const buckets = bucketsFor(owner, CONTEXT);

    expect(buckets.map((bucket) => bucket.key)).toEqual(["u1", "u2"]);
    expect(buckets[1]?.label).toContain("inactive");
  });

  test("the group key is the value that puts a row in a column", () => {
    expect(groupKeyOf("r1", index.rowsById, status)).toBe("o_doing");
    expect(groupKeyOf("r3", index.rowsById, status)).toBe(UNGROUPED_KEY);
    expect(groupKeyOf("missing", index.rowsById, status)).toBe(UNGROUPED_KEY);
  });

  test("dropping onto a column produces that column's cell value", () => {
    expect(groupValueFor(status, "o_done")).toEqual({ kind: "select", optionIds: ["o_done"] });
    expect(groupValueFor(status, UNGROUPED_KEY)).toEqual({ kind: "select", optionIds: [] });
    expect(groupValueFor(owner, "u1")).toEqual({ kind: "user", userIds: ["u1"] });
    expect(groupValueFor(title, "anything")).toBeNull();
  });

  test("flattening interleaves headers and keeps record indexes addressable", () => {
    const groups = buildGroups(rowIds, index.rowsById, status, CONTEXT, { hideEmpty: true });
    const flat = flattenGroups(groups, new Set());

    expect(flat.flat.filter((entry) => entry.kind === "group")).toHaveLength(3);
    expect(flat.rowIds).toEqual(["r1", "r4", "r2", "r3"]);
    expect(flat.flat[flat.flatIndexByRecord[1] ?? 0]).toMatchObject({ rowId: "r4" });
  });

  test("a collapsed group contributes its header and nothing else", () => {
    const groups = buildGroups(rowIds, index.rowsById, status, CONTEXT, { hideEmpty: true });
    const flat = flattenGroups(groups, new Set(["o_doing"]));

    expect(flat.rowIds).toEqual(["r2", "r3"]);
    expect(flat.flat.filter((entry) => entry.kind === "group")).toHaveLength(3);
  });

  test("ungrouped flattening is the same shape", () => {
    const flat = flattenUngrouped(rowIds);

    expect(flat.rowIds).toEqual(rowIds);
    expect(flat.flat.every((entry) => entry.kind === "record")).toBe(true);
  });
});

/* --------------------------------------------------------------- calendar */

describe("calendar", () => {
  const rows = [
    makeRow("r1", { c_due: { kind: "date", iso: "2026-08-20T09:00:00.000Z" } }),
    makeRow("r2", { c_due: { kind: "date", iso: "2026-08-20T00:00:00.000Z" } }),
    makeRow("r3", { c_due: { kind: "date", iso: null } }),
    makeRow("r4", { c_due: { kind: "date", iso: "2026-09-02T00:00:00.000Z" } }),
  ];
  const index = indexRows(rows);
  const rowIds = ["r1", "r2", "r3", "r4"];

  test("records bucket by day and undated ones become Unscheduled", () => {
    const { byDay, unscheduled } = bucketByDay(rowIds, index.rowsById, due);

    expect(byDay.get("2026-08-20")).toEqual(["r1", "r2"]);
    expect(unscheduled).toEqual(["r3"]);
  });

  test("the month grid is six Monday-first weeks and carries neighbours", () => {
    const month = buildMonth("2026-08-15T00:00:00.000Z", rowIds, index.rowsById, due, "2026-08-26T00:00:00.000Z");

    expect(month.label).toBe("Aug 2026");
    expect(month.weeks).toHaveLength(6);
    expect(month.weeks[0]).toHaveLength(7);
    expect(month.unscheduled).toEqual(["r3"]);

    const days = month.weeks.flat();
    expect(days.find((day) => day.key === "2026-08-20")?.rowIds).toEqual(["r1", "r2"]);
    expect(days.find((day) => day.key === "2026-08-26")?.isToday).toBe(true);
    expect(days.find((day) => day.key === "2026-09-02")?.isCurrentMonth).toBe(false);
  });

  test("dropping on a day keeps the time of day", () => {
    expect(moveToDay("2026-08-20T09:30:00.000Z", "2026-08-25T00:00:00.000Z")).toBe(
      "2026-08-25T09:30:00.000Z",
    );
    expect(moveToDay(null, "2026-08-25T00:00:00.000Z")).toBe("2026-08-25T00:00:00.000Z");
  });

  test("month navigation steps whole months", () => {
    expect(shiftMonth("2026-08-15T00:00:00.000Z", 1)).toBe("2026-09-01T00:00:00.000Z");
    expect(shiftMonth("2026-01-15T00:00:00.000Z", -1)).toBe("2025-12-01T00:00:00.000Z");
  });
});

/* --------------------------------------------------------------- timeline */

describe("gantt scale", () => {
  const rows = [
    makeRow("r1", {
      c_start: { kind: "date", iso: "2026-08-10T00:00:00.000Z" },
      c_due: { kind: "date", iso: "2026-08-14T00:00:00.000Z" },
    }),
    makeRow("r2", {
      c_start: { kind: "date", iso: "2026-08-20T00:00:00.000Z" },
      c_due: { kind: "date", iso: null },
    }),
    makeRow("r3"),
  ];
  const index = indexRows(rows);
  const rowIds = ["r1", "r2", "r3"];

  test("a start after its end is swapped, and the swap is reported", () => {
    const swapped = orderRange("2026-08-20T00:00:00.000Z", "2026-08-10T00:00:00.000Z");

    expect(swapped).toMatchObject({
      start: "2026-08-10T00:00:00.000Z",
      end: "2026-08-20T00:00:00.000Z",
      wasSwapped: true,
    });
    expect(orderRange("2026-08-10T00:00:00.000Z", null).wasSwapped).toBe(false);
  });

  test("bars span whole days and records with no dates are skipped", () => {
    const scale = timelineScale(rowIds, index.rowsById, start, due, "week", "2026-08-12T00:00:00.000Z");
    const bars = buildBars(rowIds, index.rowsById, start, due, scale.startIso);

    expect(bars.map((bar) => bar.rowId)).toEqual(["r1", "r2"]);
    expect(bars[0]?.span).toBe(5);
    expect(bars[1]?.isPartial).toBe(true);
    expect(bars[1]?.span).toBe(1);
    expect(bars[0]?.offset).toBe(3);
  });

  test("the scale pads the window and locates today", () => {
    const scale = timelineScale(rowIds, index.rowsById, start, due, "day", "2026-08-12T00:00:00.000Z");

    expect(scale.startIso).toBe("2026-08-07T00:00:00.000Z");
    expect(scale.dayCount).toBe(17);
    expect(scale.todayOffset).toBe(5);
    expect(offsetToIso(scale, 5)).toBe("2026-08-12T00:00:00.000Z");
  });

  test("an empty board still produces a usable window", () => {
    const scale = timelineScale([], {}, start, due, "week", "2026-08-12T00:00:00.000Z");

    expect(scale.dayCount).toBeGreaterThan(0);
    expect(scale.ticks.length).toBeGreaterThan(0);
  });

  test("zoom changes pixels per day, never the day maths", () => {
    const dayScale = timelineScale(rowIds, index.rowsById, start, due, "day", "2026-08-12T00:00:00.000Z");
    const weekScale = timelineScale(rowIds, index.rowsById, start, due, "week", "2026-08-12T00:00:00.000Z");

    expect(dayScale.dayCount).toBe(weekScale.dayCount);
    expect(dayScale.dayWidth).toBe(DAY_WIDTH.day);
    expect(weekScale.dayWidth).toBe(DAY_WIDTH.week);
  });

  /**
   * A chart that opens on a range the reader is not living in makes them hunt
   * for the present before they can read anything, so today is in the window
   * whether or not any record happens to be near it.
   */
  test("today is inside the window even when every record is months away", () => {
    const past = timelineScale(
      rowIds,
      index.rowsById,
      start,
      due,
      "week",
      "2026-12-25T00:00:00.000Z",
    );

    expect(past.todayOffset).toBeGreaterThanOrEqual(0);
    expect(past.todayOffset).toBeLessThan(past.dayCount);
    expect(offsetToIso(past, past.todayOffset)).toBe("2026-12-25T00:00:00.000Z");
  });

  test("a record dated years out trims the window instead of stretching it", () => {
    const far = [
      ...rows,
      makeRow("r4", {
        c_start: { kind: "date", iso: "2090-01-01T00:00:00.000Z" },
        c_due: { kind: "date", iso: "2090-02-01T00:00:00.000Z" },
      }),
    ];

    const scale = timelineScale(
      ["r1", "r2", "r3", "r4"],
      indexRows(far).rowsById,
      start,
      due,
      "week",
      "2026-08-12T00:00:00.000Z",
    );

    expect(scale.dayCount).toBeLessThan(2500);
    // The present survives the trim; the outlier is what falls off.
    expect(offsetToIso(scale, scale.todayOffset)).toBe("2026-08-12T00:00:00.000Z");
  });

  test("the header bands name each month once, covering the whole window", () => {
    const scale = timelineScale(rowIds, index.rowsById, start, due, "day", "2026-08-12T00:00:00.000Z");
    const keys = scale.bands.map((band) => band.key);

    expect(keys).toEqual([...new Set(keys)]);
    expect(scale.bands.reduce((total, band) => total + band.days, 0)).toBe(scale.dayCount);
    expect(scale.bands[0]?.offset).toBe(0);
  });

  test("the chart offers four scales, widest day to narrowest quarter", () => {
    expect(TIMELINE_ZOOMS).toEqual(["day", "week", "month", "quarter"]);

    // Each step out draws a day narrower — that is all zoom changes.
    const widths = TIMELINE_ZOOMS.map((zoom) => DAY_WIDTH[zoom]);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });
});

/* ---------------------------------------------------------------- filters */

describe("filter engine", () => {
  test("operators are offered per cell type", () => {
    expect(operatorsFor("text")).toContain("contains");
    expect(operatorsFor("select")).not.toContain("contains");
    expect(operatorsFor("date")).toContain("onOrBefore");
    expect(operatorsFor("attachment")).toEqual(["isEmpty", "isNotEmpty"]);
  });

  test("the value control follows the column, and disappears for presence checks", () => {
    expect(valueKindFor(status, "is")).toBe("option");
    expect(valueKindFor(owner, "is")).toBe("user");
    expect(valueKindFor(due, "before")).toBe("date");
    expect(valueKindFor(title, "contains")).toBe("text");
    expect(valueKindFor(status, "isEmpty")).toBe("none");
  });

  test("switching a condition's column keeps a compatible operator", () => {
    expect(reconcileOperator(status, "is")).toBe("is");
    expect(reconcileOperator(status, "contains")).toBe("is");
    expect(makeFilter(due, "f1")).toMatchObject({ columnId: "c_due", operator: "is", value: "" });
  });

  test("conditions describe themselves for the summary chips", () => {
    expect(describeFilter({ id: "f", columnId: "c_status", operator: "isNot", value: "Done" }, COLUMNS)).toBe(
      "Status is not Done",
    );
  });

  test("AND requires every condition, OR requires one", () => {
    const rows = [
      makeRow("r1", {
        c_status: { kind: "select", optionIds: ["o_done"] },
        c_owner: { kind: "user", userIds: ["u1"] },
      }),
      makeRow("r2", {
        c_status: { kind: "select", optionIds: ["o_todo"] },
        c_owner: { kind: "user", userIds: ["u1"] },
      }),
      makeRow("r3", {
        c_status: { kind: "select", optionIds: ["o_todo"] },
        c_owner: { kind: "user", userIds: ["u2"] },
      }),
    ];
    const index = indexRows(rows);

    const filters = [
      { id: "f1", columnId: "c_status", operator: "isNot" as const, value: "o_done" },
      { id: "f2", columnId: "c_owner", operator: "is" as const, value: "u1" },
    ];

    const all = queryRowIds({
      view: { ...VIEW, filters, filterConjunction: "and" },
      rowsById: index.rowsById,
      rowOrder: index.rowOrder,
      columns: COLUMNS,
      context: CONTEXT,
    });
    expect(all).toEqual(["r2"]);

    const any = queryRowIds({
      view: { ...VIEW, filters, filterConjunction: "or" },
      rowsById: index.rowsById,
      rowOrder: index.rowOrder,
      columns: COLUMNS,
      context: CONTEXT,
    });
    expect(any).toEqual(["r1", "r2", "r3"]);
  });

  test("select and user conditions accept an id or a label", () => {
    const rows = [makeRow("r1", { c_owner: { kind: "user", userIds: ["u2"] } })];
    const index = indexRows(rows);

    for (const value of ["u2", "Thanh Bui"]) {
      const matched = queryRowIds({
        view: { ...VIEW, filters: [{ id: "f", columnId: "c_owner", operator: "is", value }] },
        rowsById: index.rowsById,
        rowOrder: index.rowOrder,
        columns: COLUMNS,
        context: CONTEXT,
      });

      expect(matched).toEqual(["r1"]);
    }
  });

  test("date conditions compare calendar days", () => {
    const rows = [makeRow("r1", { c_due: { kind: "date", iso: "2026-08-20T18:00:00.000Z" } })];
    const index = indexRows(rows);

    const run = (operator: "is" | "before" | "onOrBefore" | "after", value: string) =>
      queryRowIds({
        view: { ...VIEW, filters: [{ id: "f", columnId: "c_due", operator, value }] },
        rowsById: index.rowsById,
        rowOrder: index.rowOrder,
        columns: COLUMNS,
        context: CONTEXT,
      });

    expect(run("is", "2026-08-20")).toEqual(["r1"]);
    expect(run("before", "2026-08-20")).toEqual([]);
    expect(run("onOrBefore", "2026-08-20")).toEqual(["r1"]);
    expect(run("after", "2026-08-19")).toEqual(["r1"]);
  });
});

/* ----------------------------------------------------------- saved views */

describe("saved views", () => {
  test("deleting a column strips it from every part of the view config", () => {
    const view: SavedView = {
      ...VIEW,
      filters: [{ id: "f", columnId: "c_gone", operator: "is", value: "x" }],
      sorts: [
        { columnId: "c_gone", direction: "asc" },
        { columnId: "c_title", direction: "asc" },
      ],
      hiddenColumnIds: ["c_gone", "c_due"],
      columnOrder: ["c_gone", "c_title"],
      groupByColumnId: "c_gone",
      dateColumnId: "c_gone",
      endDateColumnId: "c_start",
    };

    const pruned = pruneView(view, COLUMNS);

    expect(pruned.filters).toEqual([]);
    expect(pruned.sorts).toEqual([{ columnId: "c_title", direction: "asc" }]);
    expect(pruned.hiddenColumnIds).toEqual(["c_due"]);
    expect(pruned.columnOrder).toEqual(["c_title"]);
    expect(pruned.groupByColumnId).toBeNull();
    expect(pruned.dateColumnId).toBeNull();
    expect(pruned.endDateColumnId).toBe("c_start");
  });

  test("a view with nothing to prune keeps its identity", () => {
    expect(pruneView(VIEW, COLUMNS)).toBe(VIEW);
  });
});
