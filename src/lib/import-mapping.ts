import { IMPORT_MAX_ROWS } from "@/config/app";
import { parseTextIntoCell } from "@/lib/cell-conversion";
import { emptyCellFor, isCellEmpty, type CellContext } from "@/lib/cell-values";
import { columnLabel, normalizeGrid, type Grid } from "@/lib/grid";
import type {
  BoardColumn,
  CellValue,
  ColumnMapping,
  ImportDraftRow,
  ImportInvalidPolicy,
  ImportIssue,
  ImportPlan,
  ImportSource,
} from "@/types";

/**
 * Spreadsheet import (SY-IMP-35).
 *
 * The flow is upload → map → validate → confirm, and every step before the
 * last one is pure: mapping and validation compute what *would* happen without
 * touching the board, so the user sees the errors while they can still change
 * the mapping instead of after 1.000 rows have landed.
 */

export interface SourceInput {
  readonly fileName: string;
  readonly sheetName?: string | null;
  readonly grid: Grid;
  readonly hasHeaderRow: boolean;
}

/** Split a parsed sheet into a header row and the data under it. */
export function readImportSource({
  fileName,
  sheetName = null,
  grid,
  hasHeaderRow,
}: SourceInput): ImportSource {
  const normalized = normalizeGrid(grid);
  const width = normalized[0]?.length ?? 0;

  const headerRow = hasHeaderRow ? normalized[0] ?? [] : [];
  const headers = Array.from({ length: width }, (_, index) => {
    const label = headerRow[index]?.trim() ?? "";
    return label.length > 0 ? label : `Column ${columnLabel(index)}`;
  });

  const body = hasHeaderRow ? normalized.slice(1) : normalized;

  return { fileName, sheetName, headers, rows: body.slice(0, IMPORT_MAX_ROWS) };
}

/** True when the file carried more rows than one import may write. */
export function isTruncated(grid: Grid, hasHeaderRow: boolean): boolean {
  return normalizeGrid(grid).length - (hasHeaderRow ? 1 : 0) > IMPORT_MAX_ROWS;
}

/* --------------------------------------------------------------- mapping */

const NOISE = /[^a-z0-9]/g;

const normalizeName = (value: string): string => value.toLowerCase().replace(NOISE, "");

/**
 * Guess the mapping: exact name match first, then a containment match, each
 * board column claimed at most once. A guess the user disagrees with is one
 * dropdown away — a guess that silently reuses a column would not be.
 */
export function autoMapColumns(
  headers: readonly string[],
  columns: readonly BoardColumn[],
): readonly ColumnMapping[] {
  const claimed = new Set<string>();

  const claim = (predicate: (column: BoardColumn) => boolean): string | null => {
    const match = columns.find((column) => !claimed.has(column.id) && predicate(column));
    if (!match) return null;

    claimed.add(match.id);
    return match.id;
  };

  const exact = headers.map((header) => {
    const needle = normalizeName(header);
    return needle.length === 0 ? null : claim((column) => normalizeName(column.name) === needle);
  });

  return headers.map((header, sourceIndex) => {
    const already = exact[sourceIndex];
    if (already) return { sourceIndex, columnId: already };

    const needle = normalizeName(header);
    const fuzzy =
      needle.length === 0
        ? null
        : claim((column) => {
            const name = normalizeName(column.name);
            return name.includes(needle) || needle.includes(name);
          });

    return { sourceIndex, columnId: fuzzy };
  });
}

/**
 * Point one source column at a board column, releasing whichever source column
 * held it before — two columns writing the same field is never what was meant.
 */
export function setMapping(
  mappings: readonly ColumnMapping[],
  sourceIndex: number,
  columnId: string | null,
): readonly ColumnMapping[] {
  return mappings.map((mapping) => {
    if (mapping.sourceIndex === sourceIndex) return { ...mapping, columnId };
    if (columnId !== null && mapping.columnId === columnId) return { ...mapping, columnId: null };
    return mapping;
  });
}

export function mappedColumnIds(mappings: readonly ColumnMapping[]): readonly string[] {
  return mappings
    .map((mapping) => mapping.columnId)
    .filter((columnId): columnId is string => columnId !== null);
}

/* ------------------------------------------------------------ validation */

export interface PlanInput {
  readonly source: ImportSource;
  readonly mappings: readonly ColumnMapping[];
  readonly columns: readonly BoardColumn[];
  readonly context?: CellContext;
}

/**
 * Parse every mapped cell and report, per row, what the column could not read.
 * Nothing is written and nothing is thrown — an unparsable date is a finding,
 * not a failure.
 */
export function planImport({ source, mappings, columns, context = {} }: PlanInput): ImportPlan {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const active = mappings.filter(
    (mapping): mapping is ColumnMapping & { columnId: string } => mapping.columnId !== null,
  );

  const drafts: ImportDraftRow[] = [];
  const issues: ImportIssue[] = [];
  let blankCount = 0;

  source.rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const cells: Record<string, CellValue> = {};
    const invalidColumnIds: string[] = [];
    let hasValue = false;

    for (const mapping of active) {
      const column = byId.get(mapping.columnId);
      if (!column) continue;

      const raw = row[mapping.sourceIndex] ?? "";
      const result = parseTextIntoCell(raw, column, context);
      cells[column.id] = result.value;

      if (!isCellEmpty(result.value) || raw.trim().length > 0) hasValue = true;
      if (result.ok) continue;

      invalidColumnIds.push(column.id);
      issues.push({
        rowNumber,
        sourceHeader: source.headers[mapping.sourceIndex] ?? "",
        columnName: column.name,
        value: raw,
        message: messageFor(column),
      });
    }

    // Trailing empty rows are an artefact of the spreadsheet, not data.
    if (!hasValue) {
      blankCount += 1;
      return;
    }

    drafts.push({ rowNumber, cells, invalidColumnIds });
  });

  const invalidCount = drafts.filter((draft) => draft.invalidColumnIds.length > 0).length;

  return {
    drafts,
    issues,
    mappedColumnCount: active.length,
    validCount: drafts.length - invalidCount,
    invalidCount,
    blankCount,
  };
}

function messageFor(column: BoardColumn): string {
  switch (column.type) {
    case "date":
      return "Not a date the column can read — try DD/MM/YYYY or YYYY-MM-DD";
    case "select":
      return `No option named this on “${column.name}”`;
    case "user":
      return "No workspace member with that name or email";
    case "relation":
      return "No record on the linked board with that id or title";
    case "attachment":
      return "Files cannot be created from a spreadsheet cell";
    default:
      return `Could not be read as ${column.type}`;
  }
}

/**
 * The records the import will actually create.
 *
 * `skip` leaves flagged rows out entirely; `blank` imports them with the
 * offending cells empty — the two answers the PRD gives the user, made
 * explicit rather than chosen for them.
 */
export function rowsToCreate(
  plan: ImportPlan,
  policy: ImportInvalidPolicy,
  columns: readonly BoardColumn[],
): readonly Readonly<Record<string, CellValue>>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));

  return plan.drafts.flatMap((draft) => {
    if (draft.invalidColumnIds.length === 0) return [draft.cells];
    if (policy === "skip") return [];

    const cells: Record<string, CellValue> = { ...draft.cells };
    for (const columnId of draft.invalidColumnIds) {
      const column = byId.get(columnId);
      if (column) cells[columnId] = emptyCellFor(column.type);
    }

    return [cells];
  });
}
