import { describe, expect, test } from "vitest";
import {
  clampColumnWidth,
  findOptionByLabel,
  makeColumn,
  moveColumn,
  patchColumn,
  removeColumn,
  retypeColumn,
} from "@/lib/board-schema";
import {
  applyCellEdits,
  captureCells,
  indexRows,
  reconcileRows,
  removeRow,
  replaceRow,
  revertCellEdits,
} from "@/lib/board-records";
import {
  cellEquals,
  cellOf,
  cellSortKey,
  cellText,
  emptyCellFor,
  isCellEmpty,
} from "@/lib/cell-values";
import { convertCell, parseDate, parseTextIntoCell, previewConversion } from "@/lib/cell-conversion";
import { pruneView, queryRowIds, resolveColumns, visibleColumns } from "@/lib/board-view";
import type { Board, BoardColumn, BoardColumnOf, BoardRow, DirectoryUser, SavedView } from "@/types";

/* --------------------------------------------------------------- fixtures */

const title = makeColumn("c_title", "Title", "text", 0, { isPrimary: true });

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
  config: { includesTime: false },
};

const owner: BoardColumnOf<"user"> = {
  ...makeColumn("c_owner", "Owner", "user", 3),
  type: "user",
  config: { isMulti: false },
};

const COLUMNS: readonly BoardColumn[] = [title, status, due, owner];

const PEOPLE: readonly DirectoryUser[] = [
  { id: "u1", name: "Mai Tran", email: "mai@nexdrop.io", initials: "MT", isActive: true },
  { id: "u2", name: "Thanh Bui", email: "thanh@nexdrop.io", initials: "TB", isActive: false },
];

const CONTEXT = { people: new Map(PEOPLE.map((person) => [person.id, person])) };

function makeRow(id: string, overrides: Partial<BoardRow> = {}): BoardRow {
  return {
    id,
    boardId: "b1",
    displayId: `TASK-00${id.slice(-1)}`,
    sequence: Number(id.slice(-1)),
    cells: {
      c_title: { kind: "text", value: `Row ${id}` },
      c_status: { kind: "select", optionIds: ["o_todo"] },
      c_due: { kind: "date", iso: null },
      c_owner: { kind: "user", userIds: [] },
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "u1",
    revision: 1,
    ...overrides,
  };
}

/* ----------------------------------------------------------------- schema */

describe("board schema", () => {
  test("column widths are clamped to a usable range", () => {
    expect(clampColumnWidth(10)).toBe(88);
    expect(clampColumnWidth(5_000)).toBe(720);
    expect(clampColumnWidth(200.4)).toBe(200);
  });

  test("the primary column can never be hidden or deleted", () => {
    const hidden = patchColumn(COLUMNS, "c_title", { hidden: true });
    expect(hidden[0]?.hidden).toBe(false);
    expect(removeColumn(COLUMNS, "c_title")).toHaveLength(COLUMNS.length);
  });

  test("patching renames and resizes without touching siblings", () => {
    const next = patchColumn(COLUMNS, "c_status", { name: "State", width: 200 });

    expect(next[1]?.name).toBe("State");
    expect(next[1]?.width).toBe(200);
    expect(next[0]).toBe(COLUMNS[0]);
  });

  test("moving a column renumbers positions", () => {
    const moved = moveColumn(COLUMNS, "c_owner", 0);

    expect(moved.map((column) => column.id)).toEqual(["c_owner", "c_title", "c_status", "c_due"]);
    expect(moved.map((column) => column.position)).toEqual([0, 1, 2, 3]);
  });

  test("retyping swaps the config for the new type's default", () => {
    const retyped = retypeColumn(COLUMNS, "c_status", "date");
    const column = retyped[1];

    expect(column?.type).toBe("date");
    expect(column?.config).toEqual({ includesTime: false });
  });

  test("option lookup by label ignores case", () => {
    expect(findOptionByLabel(status.config.options, "done")?.id).toBe("o_done");
    expect(findOptionByLabel(status.config.options, "nope")).toBeUndefined();
  });
});

/* ----------------------------------------------------------------- values */

describe("cell values", () => {
  test("a stored value whose kind no longer matches the column reads as empty", () => {
    const row = makeRow("r1", { cells: { c_due: { kind: "text", value: "oops" } } });

    expect(cellOf(row, due)).toEqual({ kind: "date", iso: null });
  });

  test("text projection covers every type", () => {
    expect(cellText({ kind: "select", optionIds: ["o_done"] }, status, CONTEXT)).toBe("Done");
    expect(cellText({ kind: "user", userIds: ["u2"] }, owner, CONTEXT)).toBe("Thanh Bui");
    expect(cellText({ kind: "date", iso: "2026-08-20T00:00:00.000Z" }, due)).toContain("2026");
    expect(cellText({ kind: "date", iso: null, text: "next friday" }, due)).toBe("next friday");
  });

  test("emptiness accounts for preserved text", () => {
    expect(isCellEmpty(emptyCellFor("select"))).toBe(true);
    expect(isCellEmpty({ kind: "select", optionIds: [], text: "Backlog" })).toBe(false);
  });

  test("equality is structural, not referential", () => {
    expect(cellEquals({ kind: "user", userIds: ["u1"] }, { kind: "user", userIds: ["u1"] })).toBe(true);
    expect(cellEquals({ kind: "user", userIds: ["u1"] }, { kind: "user", userIds: ["u2"] })).toBe(false);
    expect(cellEquals({ kind: "text", value: "a" }, { kind: "longText", value: "a" })).toBe(false);
  });

  test("select sorts by option order and empty always ranks last", () => {
    expect(cellSortKey({ kind: "select", optionIds: ["o_done"] }, status).key).toBe(1);
    expect(cellSortKey(emptyCellFor("select"), status).isEmpty).toBe(true);
  });
});

/* ------------------------------------------------------------- conversion */

describe("column conversion", () => {
  test("dates parse ISO, day-first and engine formats", () => {
    expect(parseDate("2026-08-20")).toBe("2026-08-20T00:00:00.000Z");
    expect(parseDate("03/04/2026")).toBe("2026-04-03T00:00:00.000Z");
    expect(parseDate("2026/4/3")).toBe("2026-04-03T00:00:00.000Z");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });

  test("text that cannot become a date is kept with a warning", () => {
    const result = parseTextIntoCell("someday soon", due);

    expect(result.ok).toBe(false);
    expect(result.value).toEqual({ kind: "date", iso: null, text: "someday soon" });
  });

  test("text matching an option converts, anything else is preserved", () => {
    expect(parseTextIntoCell("done", status).value).toEqual({
      kind: "select",
      optionIds: ["o_done"],
    });

    const unmatched = parseTextIntoCell("Backlog", status);
    expect(unmatched.ok).toBe(false);
    expect(unmatched.value).toEqual({ kind: "select", optionIds: [], text: "Backlog" });
  });

  test("users resolve by name or email", () => {
    expect(parseTextIntoCell("mai@nexdrop.io", owner, CONTEXT).value).toEqual({
      kind: "user",
      userIds: ["u1"],
    });
  });

  test("converting an empty cell never warns", () => {
    expect(convertCell(emptyCellFor("text"), title, due).ok).toBe(true);
  });

  test("the preview counts what converts and what is preserved", () => {
    const rows = [
      makeRow("r1", { cells: { c_title: { kind: "text", value: "2026-08-20" } } }),
      makeRow("r2", { cells: { c_title: { kind: "text", value: "tomorrow-ish" } } }),
      makeRow("r3", { cells: { c_title: { kind: "text", value: "" } } }),
    ];

    const preview = previewConversion(rows, title, { ...due, id: "c_title" }, CONTEXT);

    expect(preview).toMatchObject({ total: 2, converted: 1, preserved: 1 });
    expect(preview.samples).toEqual(["tomorrow-ish"]);
  });
});

/* ---------------------------------------------------------------- records */

describe("normalised records", () => {
  const rows = [makeRow("r1"), makeRow("r2")];
  const index = indexRows(rows);

  test("editing one row leaves the others reference-identical", () => {
    const next = applyCellEdits(index.rowsById, [
      { rowId: "r1", columnId: "c_title", value: { kind: "text", value: "Changed" } },
    ], "2026-08-26T00:00:00.000Z");

    expect(next.r1).not.toBe(index.rowsById.r1);
    expect(next.r2).toBe(index.rowsById.r2);
  });

  test("an edit that changes nothing returns the same map", () => {
    const same = applyCellEdits(index.rowsById, [
      { rowId: "r1", columnId: "c_title", value: { kind: "text", value: "Row r1" } },
    ], "now");

    expect(same).toBe(index.rowsById);
  });

  test("rollback restores the value the mutation overwrote", () => {
    const edits = [
      { rowId: "r1", columnId: "c_title", value: { kind: "text" as const, value: "Optimistic" } },
    ];
    const reverts = captureCells(index.rowsById, edits);
    const applied = applyCellEdits(index.rowsById, edits, "now");

    const reverted = revertCellEdits(applied, reverts);

    expect(reverted.r1?.cells.c_title).toEqual({ kind: "text", value: "Row r1" });
  });

  test("a newer edit on the same cell survives an older rollback", () => {
    const edits = [
      { rowId: "r1", columnId: "c_title", value: { kind: "text" as const, value: "First" } },
    ];
    const reverts = captureCells(index.rowsById, edits);

    const afterFirst = applyCellEdits(index.rowsById, edits, "now");
    const afterSecond = applyCellEdits(afterFirst, [
      { rowId: "r1", columnId: "c_title", value: { kind: "text", value: "Second" } },
    ], "now");

    // Last write wins: the failed first mutation must not clobber it.
    expect(revertCellEdits(afterSecond, reverts).r1?.cells.c_title).toEqual({
      kind: "text",
      value: "Second",
    });
  });

  test("the server row replaces the optimistic one in place", () => {
    const optimistic = { ...index, rowOrder: ["r1", "tmp_1", "r2"] };
    const server = makeRow("r9", { displayId: "TASK-009" });

    const next = replaceRow(
      { rowsById: { ...optimistic.rowsById, tmp_1: makeRow("tmp_1") }, rowOrder: optimistic.rowOrder },
      "tmp_1",
      server,
    );

    expect(next.rowOrder).toEqual(["r1", "r9", "r2"]);
    expect(next.rowsById.tmp_1).toBeUndefined();
    expect(next.rowsById.r9?.displayId).toBe("TASK-009");
  });

  test("reconciliation takes the server's word", () => {
    const server = { ...makeRow("r1"), revision: 9 };
    expect(reconcileRows(index.rowsById, [server]).r1?.revision).toBe(9);
  });

  test("removing a row drops it from both the map and the order", () => {
    const next = removeRow(index, "r1");

    expect(next.rowsById.r1).toBeUndefined();
    expect(next.rowOrder).toEqual(["r2"]);
  });
});

/* ------------------------------------------------------------------ views */

describe("saved views", () => {
  const board: Board = {
    id: "b1",
    nodeId: "n1",
    workspaceId: "ws",
    name: "Board",
    rowIdPrefix: "TASK",
    primaryColumnId: "c_title",
    columns: COLUMNS,
    views: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const view: SavedView = {
    id: "v1",
    boardId: "b1",
    name: "All",
    type: "table",
    filters: [],
    filterConjunction: "and",
    sorts: [],
    hiddenColumnIds: ["c_due"],
    columnOrder: ["c_status", "c_title", "c_owner", "c_due"],
    columnWidths: { c_status: 300 },
    rowHeight: "medium",
    groupByColumnId: null,
    hideEmptyGroups: false,
    dateColumnId: null,
    endDateColumnId: null,
  };

  test("the view supplies order, width and visibility; the schema supplies the rest", () => {
    const resolved = resolveColumns(board, view);

    expect(resolved.map((column) => column.id)).toEqual([
      "c_status",
      "c_title",
      "c_owner",
      "c_due",
    ]);
    expect(resolved.find((column) => column.id === "c_status")?.width).toBe(300);
    expect(visibleColumns(resolved).map((column) => column.id)).not.toContain("c_due");
  });

  test("filters, search and sort run as one query", () => {
    const rows = [
      makeRow("r1", { cells: { c_title: { kind: "text", value: "Zebra" }, c_status: { kind: "select", optionIds: ["o_done"] } } }),
      makeRow("r2", { cells: { c_title: { kind: "text", value: "Alpha" }, c_status: { kind: "select", optionIds: ["o_todo"] } } }),
      makeRow("r3", { cells: { c_title: { kind: "text", value: "Beta" }, c_status: { kind: "select", optionIds: ["o_todo"] } } }),
    ];
    const index = indexRows(rows);

    const filtered = queryRowIds({
      view: { ...view, filters: [{ id: "f", columnId: "c_status", operator: "is", value: "To do" }] },
      rowsById: index.rowsById,
      rowOrder: index.rowOrder,
      columns: COLUMNS,
      context: CONTEXT,
    });
    expect(filtered).toEqual(["r2", "r3"]);

    const sorted = queryRowIds({
      view: { ...view, sorts: [{ columnId: "c_title", direction: "asc" }] },
      rowsById: index.rowsById,
      rowOrder: index.rowOrder,
      columns: COLUMNS,
      context: CONTEXT,
    });
    expect(sorted).toEqual(["r2", "r3", "r1"]);

    const searched = queryRowIds({
      view,
      rowsById: index.rowsById,
      rowOrder: index.rowOrder,
      columns: COLUMNS,
      context: CONTEXT,
      search: "zeb",
    });
    expect(searched).toEqual(["r1"]);
  });

  test("empty values always sort last, in both directions", () => {
    const rows = [
      makeRow("r1", { cells: { c_due: { kind: "date", iso: null } } }),
      makeRow("r2", { cells: { c_due: { kind: "date", iso: "2026-08-20T00:00:00.000Z" } } }),
    ];
    const index = indexRows(rows);

    for (const direction of ["asc", "desc"] as const) {
      const ordered = queryRowIds({
        view: { ...view, hiddenColumnIds: [], sorts: [{ columnId: "c_due", direction }] },
        rowsById: index.rowsById,
        rowOrder: index.rowOrder,
        columns: COLUMNS,
        context: CONTEXT,
      });

      expect(ordered[1]).toBe("r1");
    }
  });

  test("a deleted column drops out of the saved view instead of breaking it", () => {
    const pruned = pruneView(
      { ...view, filters: [{ id: "f", columnId: "gone", operator: "is", value: "x" }] },
      COLUMNS,
    );

    expect(pruned.filters).toHaveLength(0);
    expect(pruned.hiddenColumnIds).toEqual(["c_due"]);
  });
});

/* ------------------------------------------------------------ edge cases */

describe("record edge cases", () => {
  const index = indexRows([makeRow("r1")]);

  test("edits naming a row that is gone are skipped", () => {
    const next = applyCellEdits(index.rowsById, [
      { rowId: "ghost", columnId: "c_title", value: { kind: "text", value: "x" } },
    ], "now");

    expect(next).toBe(index.rowsById);
    expect(captureCells(index.rowsById, [
      { rowId: "ghost", columnId: "c_title", value: { kind: "text", value: "x" } },
    ])).toHaveLength(0);
  });

  test("rolling back a cell that had no value removes it again", () => {
    const edits = [
      { rowId: "r1", columnId: "c_new", value: { kind: "text" as const, value: "Added" } },
    ];
    const reverts = captureCells(index.rowsById, edits);
    const applied = applyCellEdits(index.rowsById, edits, "now");

    expect(revertCellEdits(applied, reverts).r1?.cells.c_new).toBeUndefined();
  });

  test("rollback and reconciliation are no-ops when there is nothing to do", () => {
    expect(revertCellEdits(index.rowsById, [{ rowId: "ghost", columnId: "c", previous: undefined, expected: { kind: "text", value: "" } }])).toBe(index.rowsById);
    expect(reconcileRows(index.rowsById, [])).toBe(index.rowsById);
    expect(removeRow(index, "ghost")).toBe(index);
  });

  test("a server row with no optimistic placeholder is appended", () => {
    const next = replaceRow(index, "tmp_missing", makeRow("r5"));

    expect(next.rowOrder).toEqual(["r1", "r5"]);
  });

  test("empty projections fall back to preserved text", () => {
    expect(cellText({ kind: "user", userIds: [], text: "someone" }, owner, CONTEXT)).toBe("someone");
    expect(cellText({ kind: "select", optionIds: ["gone"], text: "Backlog" }, status)).toBe("Backlog");
    expect(cellText({ kind: "longText", value: "note" }, title)).toBe("note");
  });

  test("equality covers the list-bearing kinds", () => {
    const file = { id: "a", name: "n", mimeType: "image/png", sizeBytes: 1, url: null, thumbnailUrl: null };

    expect(cellEquals({ kind: "attachment", attachments: [file] }, { kind: "attachment", attachments: [file] })).toBe(true);
    expect(cellEquals({ kind: "attachment", attachments: [file] }, { kind: "attachment", attachments: [] })).toBe(false);
    expect(cellEquals({ kind: "relation", rowIds: ["a"] }, { kind: "relation", rowIds: ["a"] })).toBe(true);
    expect(cellEquals(undefined, undefined)).toBe(true);
    expect(cellEquals(undefined, { kind: "text", value: "" })).toBe(false);
  });

  test("emptiness covers every kind", () => {
    expect(isCellEmpty({ kind: "longText", value: "  " })).toBe(true);
    expect(isCellEmpty({ kind: "attachment", attachments: [] })).toBe(true);
    expect(isCellEmpty({ kind: "relation", rowIds: [] })).toBe(true);
    expect(isCellEmpty({ kind: "relation", rowIds: ["r1"] })).toBe(false);
    expect(isCellEmpty({ kind: "date", iso: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });
});
