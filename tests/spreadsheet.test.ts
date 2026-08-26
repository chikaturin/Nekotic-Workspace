import { describe, expect, test } from "vitest";
import { delimiterFor, parseDelimited, toDelimited } from "@/lib/csv";
import {
  addGridColumn,
  addGridRow,
  columnLabel,
  gridColumnCount,
  normalizeGrid,
  removeGridColumn,
  removeGridRow,
  setGridCell,
  trimGrid,
} from "@/lib/grid";
import { buildXlsx, columnIndex, parseXlsx } from "@/lib/xlsx";
import { crc32, unzip, zipSync } from "@/lib/zip";

describe("grid operations", () => {
  const grid = [
    ["a", "b"],
    ["c", "d"],
  ];

  test("normalises a ragged grid to a rectangle", () => {
    expect(normalizeGrid([["a"], ["b", "c", "d"]])).toEqual([
      ["a", "", ""],
      ["b", "c", "d"],
    ]);
  });

  test("an empty grid still has one cell", () => {
    expect(normalizeGrid([])).toEqual([[""]]);
  });

  test("setting a cell leaves the other rows untouched", () => {
    const next = setGridCell(grid, 0, 1, "B");

    expect(next[0]).toEqual(["a", "B"]);
    expect(next[1]).toBe(grid[1]);
  });

  test("rows and columns insert at a position", () => {
    expect(addGridRow(grid, 1)[1]).toEqual(["", ""]);
    expect(addGridColumn(grid, 0)[0]).toEqual(["", "a", "b"]);
  });

  test("the last row and column cannot be removed", () => {
    expect(removeGridRow([["only"]], 0)).toEqual([["only"]]);
    expect(removeGridColumn([["only"]], 0)).toEqual([["only"]]);
  });

  test("removal drops the right row and column", () => {
    expect(removeGridRow(grid, 0)).toEqual([["c", "d"]]);
    expect(removeGridColumn(grid, 0)).toEqual([["b"], ["d"]]);
  });

  test("trailing blank rows and columns are trimmed on save", () => {
    const padded = [
      ["a", "b", ""],
      ["c", "d", ""],
      ["", "", ""],
    ];

    expect(trimGrid(padded)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  test("column labels follow the spreadsheet alphabet", () => {
    expect(columnLabel(0)).toBe("A");
    expect(columnLabel(25)).toBe("Z");
    expect(columnLabel(26)).toBe("AA");
    expect(gridColumnCount(grid)).toBe(2);
  });
});

describe("delimited text", () => {
  test("round-trips quoted fields, separators and newlines", () => {
    const rows = [
      ["plain", 'has "quotes"'],
      ["has,comma", "has\nnewline"],
    ];

    expect(parseDelimited(toDelimited(rows))).toEqual(rows);
  });

  test("reads a trailing field with no newline", () => {
    expect(parseDelimited("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  test("pads short rows so the grid stays rectangular", () => {
    expect(parseDelimited("a,b,c\nd")).toEqual([
      ["a", "b", "c"],
      ["d", "", ""],
    ]);
  });

  test("tsv uses tabs", () => {
    expect(delimiterFor("tsv")).toBe("\t");
    expect(delimiterFor("csv")).toBe(",");
    expect(parseDelimited("a\tb", "\t")).toEqual([["a", "b"]]);
  });
});

describe("zip container", () => {
  test("stores and reads entries back", async () => {
    const encoder = new TextEncoder();
    const archive = zipSync([
      { name: "hello.txt", data: encoder.encode("hello") },
      { name: "nested/world.txt", data: encoder.encode("world") },
    ]);

    const files = await unzip(archive);
    const decoder = new TextDecoder();

    expect(decoder.decode(files.get("hello.txt"))).toBe("hello");
    expect(decoder.decode(files.get("nested/world.txt"))).toBe("world");
  });

  test("rejects data that is not an archive", async () => {
    await expect(unzip(new Uint8Array(40))).rejects.toThrow(/ZIP/);
  });

  test("crc32 matches the reference value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("xlsx workbook", () => {
  test("round-trips a sheet through real xlsx bytes", async () => {
    const rows = [
      ["Provider", "Max amount", "Notes"],
      ["Stripe", "50,000 USD", 'quotes "and" <angles> & ampersands'],
      ["VNPay", "", "T+1"],
    ];

    const workbook = await parseXlsx(buildXlsx(rows, "Limits"));

    expect(workbook.sheetName).toBe("Limits");
    expect(workbook.rows).toEqual(rows);
  });

  test("reads cells that reference the shared-string table", async () => {
    const encoder = new TextEncoder();
    const archive = zipSync([
      {
        name: "xl/sharedStrings.xml",
        data: encoder.encode("<sst><si><t>Alpha</t></si><si><t>Be</t><t>ta</t></si></sst>"),
      },
      {
        name: "xl/worksheets/sheet1.xml",
        data: encoder.encode(
          '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row></sheetData></worksheet>',
        ),
      },
    ]);

    const workbook = await parseXlsx(archive);

    expect(workbook.rows).toEqual([["Alpha", "", "Beta"]]);
  });

  test("numeric cells keep their raw value", async () => {
    const encoder = new TextEncoder();
    const archive = zipSync([
      {
        name: "xl/worksheets/sheet1.xml",
        data: encoder.encode(
          '<worksheet><sheetData><row r="1"><c r="A1"><v>42</v></c></row></sheetData></worksheet>',
        ),
      },
    ]);

    expect((await parseXlsx(archive)).rows).toEqual([["42"]]);
  });

  test("column references map to indexes", () => {
    expect(columnIndex("A")).toBe(0);
    expect(columnIndex("Z")).toBe(25);
    expect(columnIndex("AA")).toBe(26);
  });
});
