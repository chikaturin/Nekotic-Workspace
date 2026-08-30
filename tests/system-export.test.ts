import { beforeEach, describe, expect, test } from "vitest";
import {
  buildExportGrid,
  EXPORT_FORMAT_EXTENSIONS,
  exportFileName,
  isSensitiveColumn,
  pdfLinesFrom,
  selectExportColumns,
} from "@/lib/board-export";
import { parseDelimited, toDelimited } from "@/lib/csv";
import { buildPdf } from "@/lib/pdf";
import { buildXlsx, parseXlsx, safeSheetName } from "@/lib/xlsx";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { DIRECTORY } from "@/mock/users";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumn, BoardRow } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * SY-EXP-36 — export.
 *
 * Three writers, one projection: the tests check that they agree, and that a
 * column the viewer may not read never reaches any of them.
 */

const WORKSPACE_ID = "ws_test";

const CONTEXT = { people: new Map(DIRECTORY.map((person) => [person.id, person])) };

const column = (id: string, name: string): BoardColumn => ({
  id,
  name,
  type: "text",
  position: 0,
  width: 180,
  hidden: false,
  isPrimary: false,
  config: {},
});

const row = (id: string, displayId: string, cells: Record<string, string>): BoardRow => ({
  id,
  boardId: "brd",
  displayId,
  sequence: 1,
  cells: Object.fromEntries(
    Object.entries(cells).map(([key, value]) => [key, { kind: "text", value }]),
  ),
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  createdBy: "usr",
  revision: 1,
});

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
});

describe("what may leave the workspace", () => {
  test("columns that look like credentials are recognised", () => {
    expect(isSensitiveColumn(column("a", "Stripe secret"))).toBe(true);
    expect(isSensitiveColumn(column("b", "API Key"))).toBe(true);
    expect(isSensitiveColumn(column("c", "api_key"))).toBe(true);
    expect(isSensitiveColumn(column("d", "Password reset flow"))).toBe(true);
    expect(isSensitiveColumn(column("e", "Keyboard shortcuts"))).toBe(false);
    expect(isSensitiveColumn(column("f", "Status"))).toBe(false);
  });

  test("a viewer without the right role never sees them in the projection", () => {
    const columns = [column("a", "Title"), column("b", "API key")];

    const restricted = selectExportColumns(columns, { canViewSensitive: false });
    expect(restricted.columns.map((candidate) => candidate.name)).toEqual(["Title"]);
    expect(restricted.omitted).toEqual(["API key"]);

    const grid = buildExportGrid({
      columns: restricted.columns,
      rows: [row("r1", "TASK-001", { a: "Ship it", b: "sk_live_123" })],
      context: CONTEXT,
    });

    expect(JSON.stringify(grid)).not.toContain("sk_live_123");
  });

  test("an administrator gets the whole board", () => {
    const columns = [column("a", "Title"), column("b", "API key")];
    const allowed = selectExportColumns(columns, { canViewSensitive: true });

    expect(allowed.columns).toHaveLength(2);
    expect(allowed.omitted).toHaveLength(0);
  });
});

describe("the projection", () => {
  const columns = [column("a", "Title"), column("b", "Owner")];
  const rows = [
    row("r1", "TASK-001", { a: "Ship billing", b: "Mai Tran" }),
    row("r2", "TASK-002", { a: 'Quote "this", and this', b: "" }),
  ];

  test("leads with the record id so an export round-trips", () => {
    const grid = buildExportGrid({ columns, rows, context: CONTEXT });

    expect(grid[0]).toEqual(["ID", "Title", "Owner"]);
    expect(grid[1]?.[0]).toBe("TASK-001");
  });

  test("CSV survives quotes and commas", () => {
    const grid = buildExportGrid({ columns, rows, context: CONTEXT });

    expect(parseDelimited(toDelimited(grid))).toEqual(grid);
  });

  test("Excel and CSV carry the same values", async () => {
    const grid = buildExportGrid({ columns, rows, context: CONTEXT });
    const workbook = await parseXlsx(buildXlsx(grid, "Roadmap"));

    expect(workbook.rows).toEqual(parseDelimited(toDelimited(grid)));
  });

  test("PDF lines stay inside the page width", () => {
    const wide = [row("r3", "TASK-003", { a: "x".repeat(400), b: "y".repeat(400) })];
    const lines = pdfLinesFrom(buildExportGrid({ columns, rows: wide, context: CONTEXT }));

    for (const line of lines) expect(line.length).toBeLessThanOrEqual(92);
    expect(lines.at(-1)).toMatch(/…$/);
  });

  test("a long export paginates instead of drawing off the bottom of page one", () => {
    const lines = Array.from({ length: 200 }, (_, index) => `line ${index}`);
    const pdf = buildPdf({ title: "Roadmap", lines });

    const pageCount = Number(/\/Count (\d+)/.exec(pdf)?.[1] ?? 0);
    expect(pageCount).toBeGreaterThan(5);
    expect(pdf).toContain("(line 199)");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });

  test("glyphs the writer's font cannot draw are substituted, never mis-encoded", () => {
    const pdf = buildPdf({ title: "Kiểm thử", lines: [] });

    // Every byte of the document has to be single-byte for the xref offsets to
    // hold, so anything above U+00FF becomes a question mark instead.
    expect([...pdf].every((char) => char.codePointAt(0)! <= 0xff)).toBe(true);
    expect(pdf).toContain("Ki?m th?");
  });
});

describe("workbook sheet names", () => {
  test("characters Excel refuses are replaced rather than passed through", () => {
    expect(safeSheetName("Q3: Launch [draft]")).toBe("Q3  Launch  draft");
    expect(safeSheetName("a/b\\c?d*e")).toBe("a b c d e");
  });

  test("a name is clipped to the limit and never left empty", () => {
    expect(safeSheetName("x".repeat(40))).toHaveLength(31);
    expect(safeSheetName("  ")).toBe("Sheet1");
    expect(safeSheetName("///")).toBe("Sheet1");
  });

  test("a board with an illegal name still produces a readable workbook", async () => {
    const grid = [["ID", "Title"], ["TASK-001", "Ship it"]];
    const workbook = await parseXlsx(buildXlsx(grid, "Q3: Launch"));

    expect(workbook.sheetName).toBe("Q3  Launch");
    expect(workbook.rows).toEqual(grid);
  });
});

describe("file names", () => {
  test("carry the board, the scope and the day", () => {
    expect(exportFileName("Roadmap", "board", "xlsx", "2026-08-26T09:30:00.000Z")).toBe(
      "roadmap-2026-08-26.xlsx",
    );
    expect(exportFileName("Roadmap", "view", "csv", "2026-08-26T09:30:00.000Z")).toBe(
      "roadmap-current-view-2026-08-26.csv",
    );
    expect(exportFileName("Roadmap", "selection", "pdf", "2026-08-26T09:30:00.000Z")).toBe(
      "roadmap-selected-records-2026-08-26.pdf",
    );
  });

  test("a board with no nameable characters still produces a usable file", () => {
    expect(exportFileName("///", "board", "csv", "2026-08-26T09:30:00.000Z")).toBe(
      `board-2026-08-26.${EXPORT_FORMAT_EXTENSIONS.csv}`,
    );
  });
});

describe("exporting a real board", () => {
  test("every record and every visible column reaches the grid", async () => {
    await useBoardStore.getState().load(ID.roadmap);
    const state = useBoardStore.getState();
    const board = state.board;
    if (!board) throw new Error("board did not load");

    const rows = state.rowOrder
      .map((rowId) => state.rowsById[rowId])
      .filter((candidate): candidate is BoardRow => candidate !== undefined);

    const grid = buildExportGrid({ columns: board.columns, rows, context: CONTEXT });

    expect(grid).toHaveLength(rows.length + 1);
    expect(grid[0]).toHaveLength(board.columns.length + 1);
    expect(grid[1]?.[0]).toBe("TASK-001");
  });
});
