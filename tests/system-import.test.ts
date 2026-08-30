import { beforeEach, describe, expect, test } from "vitest";
import { IMPORT_MAX_ROWS, IMPORT_SELECT_OPTION_LIMIT } from "@/config/app";
import {
  autoMapColumns,
  createTarget,
  isTruncated,
  mappingConflicts,
  newColumnDrafts,
  planColumns,
  planImport,
  unmappedBoardColumns,
  provisionalColumnId,
  readImportSource,
  resolveProvisionalIds,
  rowsToCreate,
  setMapping,
  selectOptionsFrom,
  setMappingTarget,
  targetColumnId,
} from "@/lib/import-mapping";
import { COLUMN_TYPE_LABELS, makeColumn } from "@/lib/board-schema";
import {
  creationRefusalFor,
  importRefusalFor,
  typeDescription,
} from "@/lib/import-column-types";
import { samplesFor } from "@/components/board/import/import-mapping-row";
import { parseDelimited, toDelimited } from "@/lib/csv";
import { buildXlsx, parseXlsx } from "@/lib/xlsx";
import { zipSync } from "@/lib/zip";
import { boardService } from "@/services/board-service";
import { ServiceError } from "@/services/errors";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  BoardColumn,
  ColumnMapping,
  ColumnType,
  ImportSource,
  ImportSourceRow,
} from "@/types";
import { buildTestTree, csvFile, ID, mapToColumns, TEST_WORKSPACE } from "./helpers";

/**
 * SY-IMP-35 — import.
 *
 * Mapping and validation are pure functions over the parsed file, so the tests
 * can assert exactly what *would* be written before anything is.
 */

const WORKSPACE_ID = "ws_test";

async function loadBoard() {
  await useBoardStore.getState().load(ID.roadmap);
  const board = useBoardStore.getState().board;
  if (!board) throw new Error("board did not load");
  return board;
}

function columnsOf(board: { columns: readonly BoardColumn[] }): readonly BoardColumn[] {
  return board.columns;
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    trashByWorkspace: { [WORKSPACE_ID]: [] },
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

describe("reading a spreadsheet", () => {
  const GRID = [
    ["Task Name", "Due", ""],
    ["Ship billing", "12/09/2026", "x"],
    ["Write docs", "not a date", ""],
  ];

  test("the header row names the columns and drops out of the data", () => {
    const source = readImportSource({ fileName: "plan.csv", grid: GRID, hasHeaderRow: true });

    expect(source.headers).toEqual(["Task Name", "Due", "Column C"]);
    expect(source.rows).toHaveLength(2);
  });

  test("without a header row every column gets a spreadsheet letter", () => {
    const source = readImportSource({ fileName: "plan.csv", grid: GRID, hasHeaderRow: false });

    expect(source.headers).toEqual(["Column A", "Column B", "Column C"]);
    expect(source.rows).toHaveLength(3);
  });

  test("a file longer than one import can write is truncated and says so", () => {
    const long = Array.from({ length: IMPORT_MAX_ROWS + 5 }, (_, index) => [`row ${index}`]);

    expect(isTruncated(long, false)).toBe(true);
    expect(readImportSource({ fileName: "big.csv", grid: long, hasHeaderRow: false }).rows).toHaveLength(
      IMPORT_MAX_ROWS,
    );
  });

  test("CSV and XLSX reach the mapper as the same grid", async () => {
    const csv = parseDelimited(toDelimited(GRID));
    const workbook = await parseXlsx(buildXlsx(GRID, "Plan"));

    expect(csv).toEqual(workbook.rows);
    expect(workbook.sheetName).toBe("Plan");
  });
});

describe("column mapping", () => {
  test("names that match are paired, and each board column is claimed once", async () => {
    const board = await loadBoard();
    const headers = ["Title", "Status", "Assignee", "Title"];

    const mappings = autoMapColumns(headers, columnsOf(board));
    const paired = mappings.map((mapping) =>
      board.columns.find((column) => column.id === targetColumnId(mapping))?.name ?? null,
    );

    expect(paired[0]).toBe("Title");
    expect(paired[1]).toBe("Status");
    expect(paired[2]).toBe("Assignee");
    // The second "Title" cannot claim the column the first one took.
    expect(paired[3]).not.toBe("Title");
  });

  test("a near miss still pairs — “Due” finds “Due date”", async () => {
    const board = await loadBoard();

    const mappings = autoMapColumns(["Due"], columnsOf(board));
    const target = board.columns.find((column) => column.id === targetColumnId(mappings[0]!));

    expect(target?.name).toBe("Due date");
  });

  test("a header the board has no column for becomes a column to create", async () => {
    const board = await loadBoard();

    const mappings = autoMapColumns(["Title", "Temp", "Note old"], columnsOf(board));

    expect(mappings[0]?.target.kind).toBe("existing");
    expect(newColumnDrafts(mappings).map((draft) => draft.name)).toEqual(["Temp", "Note old"]);
  });

  test("pointing a second source column at a taken board column is a conflict, not a theft", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const headers = ["Title", "Summary"];

    const initial = autoMapColumns(headers, columnsOf(board));
    const next = setMapping(initial, 1, titleId);

    // The first mapping is left exactly where the user put it.
    expect(targetColumnId(next[0]!)).toBe(titleId);
    expect(targetColumnId(next[1]!)).toBe(titleId);

    const conflicts = mappingConflicts(next, columnsOf(board), headers);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.sourceIndex).toBe(1);
    expect(conflicts[0]?.message).toMatch(/already taken/i);
  });

  test("each source column carries its own cell type", async () => {
    const board = await loadBoard();
    const headers = ["Role", "Environment", "Severity"];

    let mappings = autoMapColumns(headers, columnsOf(board));
    mappings = setMappingTarget(mappings, 0, createTarget("Role", "select"));
    mappings = setMappingTarget(mappings, 1, createTarget("Environment", "text"));
    mappings = setMappingTarget(mappings, 2, createTarget("Severity", "longText"));

    expect(newColumnDrafts(mappings)).toEqual([
      { sourceIndex: 0, name: "Role", type: "select" },
      { sourceIndex: 1, name: "Environment", type: "text" },
      { sourceIndex: 2, name: "Severity", type: "longText" },
    ]);

    // Editing the first leaves the other two exactly as they were.
    const edited = setMappingTarget(mappings, 0, createTarget("Role", "user"));
    expect(newColumnDrafts(edited)[0]?.type).toBe("user");
    expect(newColumnDrafts(edited)[1]?.type).toBe("text");
    expect(newColumnDrafts(edited)[2]?.type).toBe("longText");
  });

  test("a new column may not take a name the board already uses", async () => {
    const board = await loadBoard();
    const headers = ["Whatever"];
    const mappings = setMappingTarget(
      autoMapColumns(headers, columnsOf(board)),
      0,
      createTarget("Status", "select"),
    );

    expect(mappingConflicts(mappings, columnsOf(board), headers)[0]?.message).toMatch(
      /already has a column/i,
    );
  });

  test("two source columns may not create the same new column", async () => {
    const board = await loadBoard();
    const headers = ["A", "B"];
    let mappings = autoMapColumns(headers, columnsOf(board));
    mappings = setMappingTarget(mappings, 0, createTarget("Steps", "longText"));
    mappings = setMappingTarget(mappings, 1, createTarget("steps", "text"));

    const conflicts = mappingConflicts(mappings, columnsOf(board), headers);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.sourceIndex).toBe(1);
  });
});

describe("validation before anything is written", () => {
  /** Rows as the wizard hands them over: numbered from 2, under a header row. */
  function numbered(rows: readonly (readonly string[])[]): readonly ImportSourceRow[] {
    return rows.map((cells, index) => ({ sourceRowNumber: index + 2, cells }));
  }

  async function planFor(rows: readonly (readonly string[])[], headers: readonly string[]) {
    const board = await loadBoard();
    const source: ImportSource = {
      fileName: "plan.csv",
      sheetName: null,
      headers,
      rows: numbered(rows),
    };
    // Only the columns the board already has — these tests are about values.
    const mappings = autoMapColumns(headers, columnsOf(board)).map((mapping) =>
      mapping.target.kind === "create" ? { ...mapping, target: { kind: "ignore" as const } } : mapping,
    );

    return {
      board,
      mappings,
      plan: planImport({ source, mappings, columns: columnsOf(board), context: {} }),
    };
  }

  test("a date the column cannot read is reported against its own row", async () => {
    const { plan } = await planFor(
      [
        ["Ship billing", "12/09/2026"],
        ["Write docs", "next tuesday-ish"],
      ],
      ["Title", "Due date"],
    );

    expect(plan.validCount).toBe(1);
    expect(plan.invalidCount).toBe(1);
    expect(plan.issues).toHaveLength(1);
    // The file's own row number, header counted — what Excel shows.
    expect(plan.issues[0]?.rowNumber).toBe(3);
    expect(plan.issues[0]?.columnName).toBe("Due date");
    expect(plan.issues[0]?.value).toBe("next tuesday-ish");
    expect(plan.issues[0]?.message).toMatch(/date/i);
  });

  test("only a row that is blank in every column is ignored", async () => {
    const { plan } = await planFor([["Ship billing"], [""], ["   "]], ["Title"]);

    expect(plan.drafts).toHaveLength(1);
    expect(plan.blankCount).toBe(2);
  });

  test("skip leaves the flagged rows out; blank imports them with the cell empty", async () => {
    const { board, plan } = await planFor(
      [
        ["Ship billing", "12/09/2026"],
        ["Write docs", "not a date"],
      ],
      ["Title", "Due date"],
    );

    const dueId = board.columns.find((column) => column.name === "Due date")!.id;

    const skipped = rowsToCreate(plan, "skip", columnsOf(board));
    expect(skipped).toHaveLength(1);

    const blanked = rowsToCreate(plan, "blank", columnsOf(board));
    expect(blanked).toHaveLength(2);

    const flagged = blanked[1]?.[dueId];
    expect(flagged?.kind).toBe("date");
    // The unparsable text is dropped rather than carried through as a warning.
    expect(flagged && flagged.kind === "date" ? flagged.iso : "unset").toBeNull();
    expect(flagged && flagged.kind === "date" ? flagged.text : undefined).toBeUndefined();
  });

  test("planning writes nothing to the board", async () => {
    const before = (await boardService.getBoard(ID.roadmap)).rows.length;
    await planFor([["Ship billing"]], ["Title"]);

    expect((await boardService.getBoard(ID.roadmap)).rows).toHaveLength(before);
  });
});

describe("the import itself", () => {
  test("the board assigns every imported record its own id, in sequence", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;

    const outcome = await boardService.importRows({
      boardId: board.id,
      file: csvFile("two.csv", [["Title"], ["Imported one"], ["Imported two"]]),
      mappings: mapToColumns([titleId]),
      invalidPolicy: "skip",
    });

    const rows = (await boardService.getBoard(ID.roadmap)).rows.filter((row) =>
      outcome.rowIds.includes(row.id),
    );

    expect(rows.map((row) => row.displayId)).toEqual(["TASK-005", "TASK-006"]);
    expect(rows[0]?.revision).toBe(1);
  });

  test("cells the file did not fill are created empty rather than missing", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;

    const outcome = await boardService.importRows({
      boardId: board.id,
      file: csvFile("one.csv", [["Title"], ["Only a title"]]),
      mappings: mapToColumns([titleId]),
      invalidPolicy: "skip",
    });

    const created = (await boardService.getBoard(ID.roadmap)).rows.find(
      (row) => row.id === outcome.rowIds[0],
    );

    for (const column of board.columns) {
      expect(created?.cells[column.id]).toBeDefined();
    }
  });

  test("the store appends imported records to the end of the order", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const before = useBoardStore.getState().rowOrder.length;

    const outcome = await useBoardStore.getState().importRows({
      file: csvFile("one.csv", [["Title"], ["From a file"]]),
      mappings: mapToColumns([titleId]),
      invalidPolicy: "skip",
    });

    // Store đọc lại cả board sau khi nhập: một lần import đổi cả schema, nên
    // ghép tay phần đổi đó là đúng cái đã làm hỏng hình dạng request ban đầu.
    const { rowOrder, rowsById } = useBoardStore.getState();
    expect(rowOrder).toHaveLength(before + 1);
    expect(rowOrder.at(-1)).toBe(outcome?.rowIds[0]);
    expect(rowsById[outcome!.rowIds[0]!]?.boardId).toBe(board.id);
  });
});

/**
 * T6 — row alignment.
 *
 * The failure this guards against is silent: no error, no warning, just values
 * standing one or two rows away from the record they belong to. Every one of
 * these asserts a value against the row number the *file* gives it.
 */
describe("keeping every value on its own row", () => {
  const encoder = new TextEncoder();

  /** A worksheet written the way Excel writes one — blank rows simply absent. */
  function sheetWith(body: string): Uint8Array {
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${body}</sheetData></worksheet>`;

    return zipSync([{ name: "xl/worksheets/sheet1.xml", data: encoder.encode(xml) }]);
  }

  const cell = (row: number, column: string, value: string) =>
    `<c r="${column}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;

  test("a row Excel left out is read back as a blank row, not skipped", async () => {
    const body =
      `<row r="1">${cell(1, "A", "Case ID")}${cell(1, "B", "Step")}</row>` +
      `<row r="2">${cell(2, "A", "01")}</row>` +
      // Rows 3 and 4 hold nothing, so Excel writes no element for them at all.
      `<row r="5">${cell(5, "A", "04")}${cell(5, "B", "Login")}</row>`;

    const { rows } = await parseXlsx(sheetWith(body));

    expect(rows).toHaveLength(5);
    expect(rows[1]).toEqual(["01", ""]);
    expect(rows[2]).toEqual(["", ""]);
    expect(rows[3]).toEqual(["", ""]);
    // The value stays on row 5. Reading in document order would put it on row 3.
    expect(rows[4]).toEqual(["04", "Login"]);
  });

  test("a cell Excel left out keeps the cells after it in their own columns", async () => {
    const body =
      `<row r="1">${cell(1, "A", "ID")}${cell(1, "B", "Step")}${cell(1, "C", "Status")}</row>` +
      // No B2 at all — C2 must still be read as the third column.
      `<row r="2">${cell(2, "A", "01")}${cell(2, "C", "Ready")}</row>`;

    const { rows } = await parseXlsx(sheetWith(body));

    expect(rows[1]).toEqual(["01", "", "Ready"]);
  });

  test("a self-closing row is a blank row", async () => {
    const body =
      `<row r="1">${cell(1, "A", "ID")}</row>` +
      `<row r="2"/>` +
      `<row r="3">${cell(3, "A", "02")}</row>`;

    const { rows } = await parseXlsx(sheetWith(body));

    expect(rows.map((row) => row[0])).toEqual(["ID", "", "02"]);
  });

  test("a wild row reference cannot allocate the sheet's whole address space", async () => {
    const body = `<row r="1">${cell(1, "A", "ID")}</row><row r="900000">${cell(900000, "A", "far")}</row>`;

    const { rows } = await parseXlsx(sheetWith(body));

    expect(rows.length).toBeLessThan(100_000);
  });

  test("blank cells stay blank instead of being filled from another row", async () => {
    const board = await loadBoard();
    const headers = ["Title", "Due date"];

    // Row 2 has a title and no date; row 3 has a date and no title; row 4 both.
    const source: ImportSource = {
      fileName: "cases.xlsx",
      sheetName: null,
      headers,
      rows: [
        { sourceRowNumber: 2, cells: ["Case one", ""] },
        { sourceRowNumber: 3, cells: ["", "12/09/2026"] },
        { sourceRowNumber: 4, cells: ["Case three", "13/09/2026"] },
      ],
    };

    const mappings = autoMapColumns(headers, columnsOf(board));
    const plan = planImport({ source, mappings, columns: columnsOf(board) });

    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const dueId = board.columns.find((column) => column.name === "Due date")!.id;

    expect(plan.drafts.map((draft) => draft.rowNumber)).toEqual([2, 3, 4]);

    const [first, second, third] = plan.drafts;
    expect(first?.cells[titleId]).toEqual({ kind: "text", value: "Case one" });
    expect(first?.cells[dueId]).toMatchObject({ kind: "date", iso: null });
    expect(second?.cells[titleId]).toEqual({ kind: "text", value: "" });
    expect(second?.cells[dueId]).toMatchObject({ kind: "date" });
    expect(third?.cells[titleId]).toEqual({ kind: "text", value: "Case three" });
  });

  test("a row is dropped only when every column in it is empty", async () => {
    const board = await loadBoard();
    const headers = ["Title", "Notes"];

    const source: ImportSource = {
      fileName: "cases.csv",
      sheetName: null,
      headers,
      rows: [
        { sourceRowNumber: 2, cells: ["Case one", ""] },
        // Nothing in the mapped column, but the row is not empty.
        { sourceRowNumber: 3, cells: ["", "carried over"] },
        { sourceRowNumber: 4, cells: ["  ", "   "] },
      ],
    };

    // Notes is not imported, so only Title is written.
    const mappings = [
      { sourceIndex: 0, target: { kind: "existing" as const, columnId: board.columns[0]!.id } },
      { sourceIndex: 1, target: { kind: "ignore" as const } },
    ];

    const plan = planImport({ source, mappings, columns: columnsOf(board) });

    expect(plan.blankCount).toBe(1);
    expect(plan.drafts.map((draft) => draft.rowNumber)).toEqual([2, 3]);
  });

  test("the row number a finding quotes is the file's, not the board's", async () => {
    const board = await loadBoard();
    const headers = ["Title", "Due date"];

    const source: ImportSource = {
      fileName: "cases.xlsx",
      sheetName: null,
      headers,
      rows: [
        { sourceRowNumber: 2, cells: ["Case one", "12/09/2026"] },
        { sourceRowNumber: 3, cells: ["  ", "  "] },
        { sourceRowNumber: 8, cells: ["Case six", "whenever"] },
      ],
    };

    const plan = planImport({
      source,
      mappings: autoMapColumns(headers, columnsOf(board)),
      columns: columnsOf(board),
    });

    expect(plan.issues[0]?.rowNumber).toBe(8);
  });

  test("records are written in the file's row order", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;

    const outcome = await boardService.importRows({
      boardId: board.id,
      file: csvFile("order.csv", [["Title"], ["01"], ["02"], ["03"], ["04"], ["05"]]),
      mappings: mapToColumns([titleId]),
      invalidPolicy: "skip",
    });

    const byId = new Map(
      (await boardService.getBoard(ID.roadmap)).rows.map((row) => [row.id, row]),
    );

    expect(
      outcome.rowIds.map((rowId) => {
        const value = byId.get(rowId)?.cells[titleId];
        return value && value.kind === "text" ? value.value : null;
      }),
    ).toEqual(["01", "02", "03", "04", "05"]);
  });
});

/**
 * T1 — a column an import creates is a column like any other.
 */
describe("columns an import brings with it", () => {
  test("a provisional column is planned against, then re-keyed to the real one", async () => {
    const board = await loadBoard();
    const headers = ["Title", "Temp"];

    const mappings = autoMapColumns(headers, columnsOf(board));
    expect(newColumnDrafts(mappings)).toHaveLength(1);

    const source: ImportSource = {
      fileName: "cases.csv",
      sheetName: null,
      headers,
      rows: [{ sourceRowNumber: 2, cells: ["Case one", "scratch"] }],
    };

    const plan = planImport({ source, mappings, columns: columnsOf(board) });
    const drafted = rowsToCreate(plan, "skip", planColumns(mappings, columnsOf(board)));

    expect(drafted[0]?.[provisionalColumnId(1)]).toEqual({ kind: "text", value: "scratch" });

    const created = await boardService.createColumn(board.id, "text", "Temp");
    const resolved = resolveProvisionalIds(drafted, new Map([[1, created.id]]));

    expect(resolved[0]?.[created.id]).toEqual({ kind: "text", value: "scratch" });
    expect(resolved[0]?.[provisionalColumnId(1)]).toBeUndefined();
  });

  test("mapping onto an existing column never rewrites that column's config", async () => {
    const board = await loadBoard();
    const status = board.columns.find((column) => column.name === "Status")!;
    if (status.type !== "select") throw new Error("fixture");

    const before = status.config;
    const headers = ["Title", "Status"];

    const source: ImportSource = {
      fileName: "cases.csv",
      sheetName: null,
      headers,
      rows: [
        { sourceRowNumber: 2, cells: ["Case one", "To do"] },
        // A value the column has no option for. It is reported, not added.
        { sourceRowNumber: 3, cells: ["Case two", "Nonexistent status"] },
      ],
    };

    const plan = planImport({
      source,
      mappings: autoMapColumns(headers, columnsOf(board)),
      columns: columnsOf(board),
    });

    expect(plan.issues.some((issue) => issue.columnName === "Status")).toBe(true);

    const after = (await boardService.getBoard(ID.roadmap)).board.columns.find(
      (column) => column.id === status.id,
    );

    expect(after?.type === "select" ? after.config : null).toEqual(before);
  });

  test("importing needs the permission to import", async () => {
    const board = await loadBoard();

    useWorkspaceStore.setState({
      workspaces: [
        {
          ...TEST_WORKSPACE,
          members: TEST_WORKSPACE.members.map((member, index) =>
            index === 0 ? { ...member, role: "viewer" as const } : member,
          ),
        },
      ],
    });

    await expect(
      boardService.importRows({
        boardId: board.id,
        file: csvFile("one.csv", [["Title"], ["Nope"]]),
        mappings: [],
        invalidPolicy: "skip",
      }),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  test("a created column can be deleted again, values and all", async () => {
    const board = await loadBoard();
    const created = await boardService.createColumn(board.id, "text", "Note old");

    // Nothing marks it as coming from a file; it is an ordinary column.
    expect(created.isPrimary).toBe(false);
    expect(Object.keys(created)).not.toContain("isImported");

    const columns = await boardService.deleteColumn(board.id, created.id);
    expect(columns.some((column) => column.id === created.id)).toBe(false);
  });

  test("the board's leftover columns are named, without the one that titles a record", async () => {
    const board = await loadBoard();
    const headers = ["Title", "Status"];

    const mappings = autoMapColumns(headers, columnsOf(board));
    const leftovers = unmappedBoardColumns(mappings, columnsOf(board)).map((column) => column.name);

    // Everything the file did not claim…
    expect(leftovers).toContain("Priority");
    expect(leftovers).toContain("Assignee");
    // …except the two it did, and the column that titles a record.
    expect(leftovers).not.toContain("Status");
    expect(leftovers).not.toContain("Title");

    const primary = board.columns.find((column) => column.id === board.primaryColumnId)!;
    expect(leftovers).not.toContain(primary.name);
  });

  test("a column the file writes into is never a leftover, however it was mapped", async () => {
    const board = await loadBoard();
    const status = board.columns.find((column) => column.name === "Status")!;

    const mappings = [
      { sourceIndex: 0, target: { kind: "existing" as const, columnId: status.id } },
      { sourceIndex: 1, target: { kind: "create" as const, name: "Steps", type: "longText" as const } },
      { sourceIndex: 2, target: { kind: "ignore" as const } },
    ];

    const leftovers = unmappedBoardColumns(mappings, columnsOf(board)).map((column) => column.id);
    expect(leftovers).not.toContain(status.id);
  });

  test("a cell whose provisional column was never created is dropped, not invented", () => {
    const resolved = resolveProvisionalIds(
      [
        {
          col_title: { kind: "text", value: "kept" },
          [provisionalColumnId(1)]: { kind: "text", value: "landed" },
          [provisionalColumnId(3)]: { kind: "text", value: "lost" },
        },
      ],
      new Map([[1, "col_real"]]),
    );

    expect(resolved[0]).toEqual({
      col_title: { kind: "text", value: "kept" },
      col_real: { kind: "text", value: "landed" },
    });
  });
});

/**
 * Những gì màn hình ánh xạ NÓI RA.
 *
 * Bước này từng chỉ hiện tên cột và một biểu tượng kiểu không chú thích, nên
 * người dùng phải đoán cả hai đầu: cột "Role" đựng gì, và một chữ T nghĩa là
 * gì. Ba hàm dưới đây là phần trả lời được, nên chúng được kiểm ở đây.
 */
describe("what the mapping step can say about a column", () => {
  const rows = (values: readonly (readonly string[])[]) =>
    values.map((cells, index) => ({ sourceRowNumber: index + 1, cells }));

  test("takes real values from the file as the example line", () => {
    const samples = samplesFor(
      rows([
        ["QA", "Login works"],
        ["Dev", "Logout works"],
      ]),
      0,
    );

    expect(samples).toEqual(["QA", "Dev"]);
  });

  test("skips blanks and repeats, so three examples are three different things", () => {
    const samples = samplesFor(rows([["QA"], [""], ["QA"], ["  "], ["PM"], ["Dev"], ["BA"]]), 0);

    // Ba giá trị KHÁC NHAU, không phải ba dòng đầu tiên.
    expect(samples).toEqual(["QA", "PM", "Dev"]);
  });

  test("a column with nothing in it yields no examples rather than empty strings", () => {
    expect(samplesFor(rows([[""], ["   "]]), 0)).toEqual([]);
  });

  test("every column type has a description in plain words", () => {
    for (const type of Object.keys(COLUMN_TYPE_LABELS) as ColumnType[]) {
      expect(typeDescription(type).length).toBeGreaterThan(0);
      // Không được chỉ lặp lại chính cái nhãn nó đang giải thích.
      expect(typeDescription(type)).not.toBe(COLUMN_TYPE_LABELS[type]);
    }
  });

  /**
   * Ba kiểu này server TỪ CHỐI vô điều kiện khi import (`coerce` trả `null`),
   * nên đề nghị chúng ra là đề nghị một lựa chọn chắc chắn hỏng.
   */
  test("refuses the target types a spreadsheet cell cannot fill, with a reason", () => {
    for (const type of ["user", "attachment", "relation"] as const) {
      expect(importRefusalFor(makeColumn("c", "C", type, 0))).not.toBeNull();
      expect(creationRefusalFor(type)).not.toBeNull();
    }
  });

  test("Select is offered for a new column — its labels come from the file", () => {
    expect(creationRefusalFor("select")).toBeNull();
  });

  test("a select column with labels is fine; one without has nothing to match", () => {
    const select = makeColumn("c", "Status", "select", 0);
    expect(importRefusalFor(select)).not.toBeNull();

    // Thu hẹp trước khi spread: `makeColumn` trả về union, và một bản sao mất
    // discriminant thì `config` không còn là config của select nữa.
    if (select.type !== "select") throw new Error("expected a select column");

    const filled: BoardColumn = {
      ...select,
      config: { ...select.config, options: [{ id: "o1", label: "Open", color: "blue" }] },
    };
    expect(importRefusalFor(filled)).toBeNull();
  });

  test("text, long text and date are always offered", () => {
    for (const type of ["text", "longText", "date"] as const) {
      expect(creationRefusalFor(type)).toBeNull();
      expect(importRefusalFor(makeColumn("c", "C", type, 0))).toBeNull();
    }
  });
});

describe("guessing where a column goes", () => {
  /**
   * "Expected Result" chứa chữ "Result", nên khớp gần đúng từng cho nó cột
   * Select tên Result — và mọi ô văn xuôi trong file rơi vào một cột chỉ nhận
   * nhãn có sẵn. Bản xem trước sẽ đỏ toàn bộ, và người dùng không hiểu vì sao.
   */
  test("a loose name match never claims a column that cannot hold the text", () => {
    const columns = [
      makeColumn("c_result", "Result", "select", 0),
      makeColumn("c_notes", "Notes", "longText", 1),
    ];

    const [mapping] = autoMapColumns(["Expected Result"], columns);

    expect(mapping?.target.kind).toBe("create");
  });

  test("an exact name still wins — a Status column named Status is deliberate", () => {
    const columns = [makeColumn("c_status", "Status", "select", 0)];

    const [mapping] = autoMapColumns(["Status"], columns);

    expect(mapping?.target).toEqual({ kind: "existing", columnId: "c_status" });
  });

  test("a loose match onto a type that can hold text still works", () => {
    const columns = [makeColumn("c_notes", "Notes", "longText", 0)];

    const [mapping] = autoMapColumns(["Extra Notes"], columns);

    expect(mapping?.target).toEqual({ kind: "existing", columnId: "c_notes" });
  });
});

/**
 * Một cột Select do import dựng ra lấy nhãn TỪ CHÍNH FILE.
 *
 * Trước đây cột mới ra đời với `options: []`, nên mọi ô đều không khớp: chọn
 * Select là chọn một cột chắc chắn rỗng. Dữ liệu để dựng nhãn vốn nằm sẵn
 * trong file đang đọc.
 */
describe("a select column the import creates", () => {
  const source = (values: readonly string[]): ImportSource => ({
    fileName: "s.csv",
    sheetName: null,
    headers: ["Status"],
    rows: values.map((value, index) => ({ sourceRowNumber: index + 2, cells: [value] })),
  });

  const createSelect: readonly ColumnMapping[] = [
    { sourceIndex: 0, target: { kind: "create", name: "Status", type: "select" } },
  ];

  test("takes its labels from the values in that column", () => {
    const options = selectOptionsFrom(source(["Open", "Closed", "Open", ""]).rows, 0);

    expect(options.map((option) => option.label)).toEqual(["Open", "Closed"]);
  });

  test("folds case, because matching folds case too", () => {
    const options = selectOptionsFrom(source(["Open", "open", "OPEN"]).rows, 0);

    expect(options).toHaveLength(1);
  });

  test("every row then reads cleanly — no issues at all", () => {
    const plan = planImport({
      source: source(["Open", "Closed", "Blocked", "Open"]),
      mappings: createSelect,
      columns: [],
    });

    expect(plan.issues).toHaveLength(0);
    expect(plan.invalidCount).toBe(0);
    expect(plan.validCount).toBe(4);
  });

  test("too many distinct values is refused, not silently truncated", () => {
    const many = Array.from({ length: IMPORT_SELECT_OPTION_LIMIT + 1 }, (_, i) => `v${i}`);

    const conflicts = mappingConflicts(createSelect, [], ["Status"], source(many).rows);

    expect(conflicts[0]?.message).toContain("too many for a select column");
  });

  test("right at the limit it is still allowed", () => {
    const exactly = Array.from({ length: IMPORT_SELECT_OPTION_LIMIT }, (_, i) => `v${i}`);

    expect(mappingConflicts(createSelect, [], ["Status"], source(exactly).rows)).toEqual([]);
  });
});
