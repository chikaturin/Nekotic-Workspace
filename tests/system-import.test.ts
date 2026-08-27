import { beforeEach, describe, expect, test } from "vitest";
import { IMPORT_MAX_ROWS } from "@/config/app";
import {
  autoMapColumns,
  isTruncated,
  mappedColumnIds,
  planImport,
  readImportSource,
  rowsToCreate,
  setMapping,
} from "@/lib/import-mapping";
import { parseDelimited, toDelimited } from "@/lib/csv";
import { buildXlsx, parseXlsx } from "@/lib/xlsx";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumn, ImportSource } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

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
  boardService.reset();

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
      board.columns.find((column) => column.id === mapping.columnId)?.name ?? null,
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
    const target = board.columns.find((column) => column.id === mappings[0]?.columnId);

    expect(target?.name).toBe("Due date");
  });

  test("pointing a second source column at a taken board column releases the first", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;

    const initial = autoMapColumns(["Title", "Summary"], columnsOf(board));
    const next = setMapping(initial, 1, titleId);

    expect(next[0]?.columnId).toBeNull();
    expect(next[1]?.columnId).toBe(titleId);
    expect(mappedColumnIds(next)).toEqual([titleId]);
  });
});

describe("validation before anything is written", () => {
  async function planFor(rows: readonly (readonly string[])[], headers: readonly string[]) {
    const board = await loadBoard();
    const source: ImportSource = { fileName: "plan.csv", sheetName: null, headers, rows };
    const mappings = autoMapColumns(headers, columnsOf(board));

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
    expect(plan.issues[0]?.rowNumber).toBe(2);
    expect(plan.issues[0]?.columnName).toBe("Due date");
    expect(plan.issues[0]?.value).toBe("next tuesday-ish");
    expect(plan.issues[0]?.message).toMatch(/date/i);
  });

  test("rows with nothing in any mapped column are ignored, not imported empty", async () => {
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

    const created = await boardService.importRows({
      boardId: board.id,
      rows: [
        { [titleId]: { kind: "text", value: "Imported one" } },
        { [titleId]: { kind: "text", value: "Imported two" } },
      ],
    });

    expect(created.map((row) => row.displayId)).toEqual(["TASK-005", "TASK-006"]);
    expect(created[0]?.revision).toBe(1);
  });

  test("cells the file did not fill are created empty rather than missing", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;

    const [created] = await boardService.importRows({
      boardId: board.id,
      rows: [{ [titleId]: { kind: "text", value: "Only a title" } }],
    });

    for (const column of board.columns) {
      expect(created?.cells[column.id]).toBeDefined();
    }
  });

  test("the store appends imported records to the end of the order", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const before = useBoardStore.getState().rowOrder.length;

    const created = await useBoardStore
      .getState()
      .importRows([{ [titleId]: { kind: "text", value: "From a file" } }]);

    const { rowOrder, rowsById } = useBoardStore.getState();
    expect(rowOrder).toHaveLength(before + 1);
    expect(rowOrder.at(-1)).toBe(created?.[0]?.id);
    expect(rowsById[created![0]!.id]?.boardId).toBe(board.id);
  });
});
