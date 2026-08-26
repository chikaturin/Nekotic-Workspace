import { EXPORT_PDF_LINE_WIDTH } from "@/config/app";
import { cellText, type CellContext } from "@/lib/cell-values";
import type { Grid } from "@/lib/grid";
import { slugify } from "@/lib/utils";
import type { BoardColumn, BoardRow, ExportFormat, ExportScope } from "@/types";

/**
 * Turning a board into a file (SY-EXP-36).
 *
 * Every format reads the same rectangular projection, built once from the
 * cells' plain-text form — the representation copy, search and column
 * conversion already share. XLSX, CSV and PDF therefore cannot disagree about
 * what a record says.
 */

export const EXPORT_FORMAT_LABELS: Readonly<Record<ExportFormat, string>> = {
  xlsx: "Excel",
  csv: "CSV",
  pdf: "PDF",
};

export const EXPORT_FORMAT_EXTENSIONS: Readonly<Record<ExportFormat, string>> = {
  xlsx: "xlsx",
  csv: "csv",
  pdf: "pdf",
};

export const EXPORT_MIME_TYPES: Readonly<Record<ExportFormat, string>> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
  pdf: "application/pdf",
};

export const EXPORT_SCOPE_LABELS: Readonly<Record<ExportScope, string>> = {
  board: "Entire board",
  view: "Current view",
  selection: "Selected records",
};

/**
 * Columns withheld from an export unless the viewer may read them.
 *
 * Column-level ACLs are a backend concern; until they exist this name test is
 * the honest stand-in, and it is deliberately conservative — a column called
 * "API key" leaves the file rather than leaking into a spreadsheet somebody
 * mails on.
 */
const SENSITIVE_NAMES = /secret|token|password|credential|api[\s_-]?key|private[\s_-]?key/i;

export const isSensitiveColumn = (column: BoardColumn): boolean =>
  SENSITIVE_NAMES.test(column.name);

export interface ColumnFilterOptions {
  /** Whether the viewer may read sensitive columns at all. */
  readonly canViewSensitive: boolean;
}

export interface ColumnSelection {
  readonly columns: readonly BoardColumn[];
  readonly omitted: readonly string[];
}

/** Split the columns into what the file may carry and what it must not. */
export function selectExportColumns(
  columns: readonly BoardColumn[],
  { canViewSensitive }: ColumnFilterOptions,
): ColumnSelection {
  if (canViewSensitive) return { columns, omitted: [] };

  const kept = columns.filter((column) => !isSensitiveColumn(column));
  return {
    columns: kept,
    omitted: columns.filter(isSensitiveColumn).map((column) => column.name),
  };
}

export interface ExportGridInput {
  readonly columns: readonly BoardColumn[];
  readonly rows: readonly BoardRow[];
  readonly context: CellContext;
  /** Lead every record with its display id, so an export round-trips. */
  readonly includeRecordId?: boolean;
}

/** Header row plus one row per record — the shape every writer consumes. */
export function buildExportGrid({
  columns,
  rows,
  context,
  includeRecordId = true,
}: ExportGridInput): Grid {
  const header = [
    ...(includeRecordId ? ["ID"] : []),
    ...columns.map((column) => column.name),
  ];

  const body = rows.map((row) => [
    ...(includeRecordId ? [row.displayId] : []),
    ...columns.map((column) => {
      const value = row.cells[column.id];
      return value ? cellText(value, column, context) : "";
    }),
  ]);

  return [header, ...body];
}

/** `roadmap-current-view-2026-08-26.csv` — sortable and self-describing. */
export function exportFileName(
  boardName: string,
  scope: ExportScope,
  format: ExportFormat,
  nowIso: string,
): string {
  const day = nowIso.slice(0, 10);
  const scopeSlug = scope === "board" ? "" : `-${slugify(EXPORT_SCOPE_LABELS[scope])}`;

  return `${slugify(boardName) || "board"}${scopeSlug}-${day}.${EXPORT_FORMAT_EXTENSIONS[format]}`;
}

/**
 * One line per record for the PDF writer, which draws text rather than tables.
 * Cells are joined with a middot and the line is clipped to the page width, so
 * a long description cannot run off the right edge unnoticed.
 */
export function pdfLinesFrom(grid: Grid, width = EXPORT_PDF_LINE_WIDTH): readonly string[] {
  return grid.map((row) => clip(row.map((cell) => collapse(cell)).join("  ·  "), width));
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`;
}
