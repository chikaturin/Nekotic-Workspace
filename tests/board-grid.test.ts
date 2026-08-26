import { describe, expect, test } from "vitest";
import { indexRows } from "@/lib/board-records";
import { makeColumn } from "@/lib/board-schema";
import { clearRange, copyRange, pasteRange } from "@/lib/grid-clipboard";
import { scrollOffsetFor, windowRange } from "@/lib/grid-geometry";
import {
  advanceAddress,
  boxSize,
  extendRange,
  isInBox,
  moveAddress,
  rangeBox,
  retreatAddress,
  selectAll,
  singleRange,
} from "@/lib/grid-selection";
import { extractRowReferences, formatRowId, matchesRowId, normalizePrefix } from "@/lib/row-id";
import type { BoardColumn, BoardColumnOf, BoardRow } from "@/types";

const title = makeColumn("c_title", "Title", "text", 0, { isPrimary: true });
const due: BoardColumnOf<"date"> = {
  ...makeColumn("c_due", "Due", "date", 1),
  type: "date",
  config: { includesTime: false },
};
const COLUMNS: readonly BoardColumn[] = [title, due];

function makeRow(id: string, text: string, iso: string | null): BoardRow {
  return {
    id,
    boardId: "b1",
    displayId: `TASK-00${id.slice(-1)}`,
    sequence: 1,
    cells: {
      c_title: { kind: "text", value: text },
      c_due: { kind: "date", iso },
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "u1",
    revision: 1,
  };
}

const rows = [makeRow("r1", "Alpha", "2026-08-20T00:00:00.000Z"), makeRow("r2", "Beta", null)];
const slice = {
  rowIds: ["r1", "r2"],
  columns: COLUMNS,
  rowsById: indexRows(rows).rowsById,
  context: {},
};

describe("row identifiers", () => {
  test("display ids pad to three digits and grow past them", () => {
    expect(formatRowId("TASK", 7)).toBe("TASK-007");
    expect(formatRowId("QA", 1284)).toBe("QA-1284");
  });

  test("prefixes are upper-case letters, capped in length", () => {
    expect(normalizePrefix("qa board 12")).toBe("QABOAR");
    expect(normalizePrefix("t")).toBe("T");
  });

  test("references are pulled out of free text", () => {
    const found = extractRowReferences("QA-128 failed because of BUG-042");

    expect(found.map((reference) => reference.raw)).toEqual(["QA-128", "BUG-042"]);
    expect(found[1]).toMatchObject({ prefix: "BUG", sequence: 42 });
  });

  test("search matches padded and unpadded forms", () => {
    expect(matchesRowId("TASK-007", "task 7")).toBe(true);
    expect(matchesRowId("TASK-007", "TASK-0")).toBe(true);
    expect(matchesRowId("TASK-007", "TASK-8")).toBe(false);
  });
});

describe("grid selection", () => {
  const bounds = { rowCount: 5, columnCount: 3 };

  test("a range normalises whichever way it was dragged", () => {
    const box = rangeBox({ anchor: { rowIndex: 3, columnIndex: 2 }, focus: { rowIndex: 1, columnIndex: 0 } });

    expect(box).toEqual({ top: 1, left: 0, bottom: 3, right: 2 });
    expect(boxSize(box)).toBe(9);
    expect(isInBox(box, 2, 1)).toBe(true);
    expect(isInBox(box, 4, 1)).toBe(false);
  });

  test("movement clamps at the edges", () => {
    expect(moveAddress({ rowIndex: 0, columnIndex: 0 }, "up", bounds)).toEqual({
      rowIndex: 0,
      columnIndex: 0,
    });
    expect(moveAddress({ rowIndex: 0, columnIndex: 0 }, "bottom", bounds).rowIndex).toBe(4);
    expect(moveAddress({ rowIndex: 2, columnIndex: 0 }, "rowEnd", bounds).columnIndex).toBe(2);
  });

  test("tab wraps to the next row and shift-tab back", () => {
    expect(advanceAddress({ rowIndex: 0, columnIndex: 2 }, bounds)).toEqual({
      rowIndex: 1,
      columnIndex: 0,
    });
    expect(retreatAddress({ rowIndex: 1, columnIndex: 0 }, bounds)).toEqual({
      rowIndex: 0,
      columnIndex: 2,
    });
  });

  test("extending keeps the anchor still", () => {
    const extended = extendRange(singleRange({ rowIndex: 1, columnIndex: 1 }), "down", bounds);

    expect(extended.anchor).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(extended.focus).toEqual({ rowIndex: 2, columnIndex: 1 });
    expect(boxSize(rangeBox(selectAll(bounds)))).toBe(15);
  });
});

describe("grid clipboard", () => {
  test("a range copies as TSV a spreadsheet can read", () => {
    const text = copyRange(slice, { top: 0, left: 0, bottom: 1, right: 1 });

    expect(text.split("\n")).toHaveLength(2);
    expect(text.split("\n")[0]?.split("\t")[0]).toBe("Alpha");
  });

  test("pasting parses each value into its target column's type", () => {
    const result = pasteRange(slice, { top: 0, left: 0, bottom: 0, right: 0 }, "Gamma\t2026-09-01");

    expect(result.edits).toHaveLength(2);
    expect(result.edits[1]?.value).toEqual({ kind: "date", iso: "2026-09-01T00:00:00.000Z" });
    expect(result.preserved).toBe(0);
  });

  test("a value the column cannot parse is preserved and counted", () => {
    const result = pasteRange(slice, { top: 0, left: 1, bottom: 0, right: 1 }, "sometime");

    expect(result.preserved).toBe(1);
    expect(result.edits[0]?.value).toEqual({ kind: "date", iso: null, text: "sometime" });
  });

  test("clipboard content beyond the grid is reported, not silently dropped", () => {
    const result = pasteRange(slice, { top: 1, left: 1, bottom: 1, right: 1 }, "a\tb\nc\td");

    expect(result.skipped).toBe(3);
  });

  test("clearing writes the empty value for each column type", () => {
    const edits = clearRange(slice, { top: 0, left: 0, bottom: 1, right: 1 });

    expect(edits).toHaveLength(4);
    expect(edits[1]?.value).toEqual({ kind: "date", iso: null });
  });
});

describe("row virtualisation", () => {
  test("only the visible window plus overscan is mounted", () => {
    const range = windowRange({
      scrollTop: 4_400,
      viewportHeight: 440,
      rowHeight: 44,
      count: 5_000,
      overscan: 5,
    });

    expect(range.start).toBe(95);
    expect(range.end).toBe(116);
    expect(range.end - range.start).toBeLessThan(30);
    expect(range.totalHeight).toBe(220_000);
    expect(range.paddingTop + (range.end - range.start) * 44 + range.paddingBottom).toBe(220_000);
  });

  test("an empty board mounts nothing", () => {
    expect(windowRange({ scrollTop: 0, viewportHeight: 400, rowHeight: 44, count: 0, overscan: 5 })).
      toMatchObject({ start: 0, end: 0, totalHeight: 0 });
  });

  test("scrolling to a row only moves when the row is off screen", () => {
    expect(scrollOffsetFor(2, 0, 440, 44)).toBeNull();
    expect(scrollOffsetFor(0, 200, 440, 44)).toBe(0);
    expect(scrollOffsetFor(20, 0, 440, 44)).toBe(484);
  });
});
