import { IMPORT_MAX_ROWS } from "@/config/app";
import { parseTextIntoCell } from "@/lib/cell-conversion";
import { isProtectedColumn, makeColumn } from "@/lib/board-schema";
import { emptyCellFor, type CellContext } from "@/lib/cell-values";
import { columnLabel, normalizeGrid, type Grid } from "@/lib/grid";
import type {
  BoardColumn,
  CellValue,
  ColumnMapping,
  ColumnType,
  ImportDraftRow,
  ImportInvalidPolicy,
  ImportIssue,
  ImportPlan,
  ImportSource,
  ImportSourceRow,
  MappingConflict,
  MappingTarget,
} from "@/types";

/**
 * Spreadsheet import (SY-IMP-35).
 *
 * The flow is upload → map → validate → confirm, and every step before the
 * last one is pure: mapping and validation compute what *would* happen without
 * touching the board, so the user sees the errors while they can still change
 * the mapping instead of after 1.000 rows have landed.
 *
 * Two invariants hold the data straight:
 *
 *   - **A row is a row.** Cells are carried per source row, with the file's own
 *     row number attached, and nothing is ever filtered out of a column and
 *     zipped back together by position. That is the shape of the bug where a
 *     blank cell high in the file pulls every value below it up a row.
 *   - **A target belongs to one source column.** Two source columns cannot
 *     write the same board column, and a source column that creates its own
 *     column holds that decision itself — there is no shared draft for one
 *     column's cell type to leak out of.
 */

export interface SourceInput {
  readonly fileName: string;
  readonly sheetName?: string | null;
  readonly grid: Grid;
  readonly hasHeaderRow: boolean;
}

/**
 * Split a parsed sheet into a header row and the data under it.
 *
 * Row numbers are assigned before the header is taken off and before the row
 * cap is applied, so they keep meaning "the row Excel would show you" no matter
 * what the wizard does with the rows afterwards.
 */
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

  const numbered: ImportSourceRow[] = normalized.map((cells, index) => ({
    sourceRowNumber: index + 1,
    cells,
  }));

  const body = hasHeaderRow ? numbered.slice(1) : numbered;

  return { fileName, sheetName, headers, rows: body.slice(0, IMPORT_MAX_ROWS) };
}

/** True when the file carried more rows than one import may write. */
export function isTruncated(grid: Grid, hasHeaderRow: boolean): boolean {
  return normalizeGrid(grid).length - (hasHeaderRow ? 1 : 0) > IMPORT_MAX_ROWS;
}

/* --------------------------------------------------------------- mapping */

const NOISE = /[^a-z0-9]/g;

const normalizeName = (value: string): string => value.toLowerCase().replace(NOISE, "");

export const IGNORE: MappingTarget = { kind: "ignore" };

export function existingTarget(columnId: string): MappingTarget {
  return { kind: "existing", columnId };
}

export function createTarget(name: string, type: ColumnType): MappingTarget {
  return { kind: "create", name, type };
}

/** The board column a mapping writes into, or null when it writes nowhere. */
export function targetColumnId(mapping: ColumnMapping): string | null {
  return mapping.target.kind === "existing" ? mapping.target.columnId : null;
}

/**
 * How a column this import would create is addressed before it exists.
 *
 * Planning has to parse values against it and the drafts have to key cells by
 * *something*, so it gets a provisional id derived from its source column. The
 * confirm step swaps every one of these for the real id the board hands back.
 */
export function provisionalColumnId(sourceIndex: number): string {
  return `new_${sourceIndex}`;
}

export function isProvisionalColumnId(columnId: string): boolean {
  return columnId.startsWith("new_");
}

/**
 * Which cell type to offer for a column the file brings and the board lacks.
 *
 * A guess from the header alone, and deliberately a shallow one: Text takes
 * anything, so being wrong costs a dropdown rather than a failed import. Only
 * the two names that are unambiguous in every board this app ships get a
 * stronger guess.
 */
const DATE_NAME = /(^|[^a-z])(date|due|deadline|start|end|created|updated)([^a-z]|$)/i;
const LONG_NAME = /(step|description|note|notes|detail|details|summary|expected|actual|result)/i;

export function guessColumnType(header: string): ColumnType {
  if (DATE_NAME.test(header)) return "date";
  if (LONG_NAME.test(header)) return "longText";
  return "text";
}

/**
 * Guess the mapping: exact name match first, then a containment match, each
 * board column claimed at most once. Whatever the board has no column for
 * becomes a column this import would create, named after the file's own header
 * — which is what makes an extra column in the sheet arrive as a column on the
 * board rather than being silently dropped.
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
    if (already) return { sourceIndex, target: existingTarget(already) };

    const needle = normalizeName(header);
    const fuzzy =
      needle.length === 0
        ? null
        : claim((column) => {
            const name = normalizeName(column.name);
            return name.includes(needle) || needle.includes(name);
          });

    if (fuzzy) return { sourceIndex, target: existingTarget(fuzzy) };

    return {
      sourceIndex,
      target: createTarget(header.trim() || `Column ${columnLabel(sourceIndex)}`, guessColumnType(header)),
    };
  });
}

/**
 * Point one source column somewhere.
 *
 * Nothing is released from any other source column. Claiming a board column
 * that another source column already writes used to quietly unmap the first
 * one, which reads from the user's side as the mapping "jumping" between
 * columns; it is now left in place and reported as a conflict they resolve
 * themselves. A change the user did not ask for is worse than an error they
 * can see.
 */
export function setMappingTarget(
  mappings: readonly ColumnMapping[],
  sourceIndex: number,
  target: MappingTarget,
): readonly ColumnMapping[] {
  return mappings.map((mapping) =>
    mapping.sourceIndex === sourceIndex ? { ...mapping, target } : mapping,
  );
}

/** Convenience for the common case: an existing column, or nothing. */
export function setMapping(
  mappings: readonly ColumnMapping[],
  sourceIndex: number,
  columnId: string | null,
): readonly ColumnMapping[] {
  return setMappingTarget(
    mappings,
    sourceIndex,
    columnId === null ? IGNORE : existingTarget(columnId),
  );
}

/**
 * Board columns this import writes nothing into.
 *
 * What the user is offered as "the board's leftovers": a QA board made from a
 * template arrives with columns nobody asked for, and importing a file that
 * defines the real ones leaves them sitting there empty. The column that titles
 * a record is never in this list — it is the one thing the board cannot lose.
 */
export function unmappedBoardColumns(
  mappings: readonly ColumnMapping[],
  columns: readonly BoardColumn[],
): readonly BoardColumn[] {
  const written = new Set(mappings.map(targetColumnId).filter((id): id is string => id !== null));

  return columns.filter((column) => !written.has(column.id) && !isProtectedColumn(column));
}

/** Source columns that would add a column to the board, in file order. */
export function newColumnDrafts(
  mappings: readonly ColumnMapping[],
): readonly { readonly sourceIndex: number; readonly name: string; readonly type: ColumnType }[] {
  return mappings.flatMap((mapping) =>
    mapping.target.kind === "create"
      ? [{ sourceIndex: mapping.sourceIndex, name: mapping.target.name, type: mapping.target.type }]
      : [],
  );
}

/**
 * What the mapping gets wrong, checked against the board's *current* schema
 * rather than against anything a dialog is holding.
 *
 * Three things stop an import: two source columns writing one board column, a
 * new column whose name is already taken, and a new column with no name. Each
 * is reported against the source column that has to change.
 */
export function mappingConflicts(
  mappings: readonly ColumnMapping[],
  columns: readonly BoardColumn[],
  headers: readonly string[] = [],
): readonly MappingConflict[] {
  const conflicts: MappingConflict[] = [];
  const nameOf = (index: number) => headers[index] ?? `Column ${columnLabel(index)}`;

  const claimants = new Map<string, number[]>();
  for (const mapping of mappings) {
    const columnId = targetColumnId(mapping);
    if (columnId === null) continue;
    claimants.set(columnId, [...(claimants.get(columnId) ?? []), mapping.sourceIndex]);
  }

  for (const [columnId, sources] of claimants) {
    if (sources.length < 2) continue;
    const column = columns.find((candidate) => candidate.id === columnId);

    for (const sourceIndex of sources.slice(1)) {
      conflicts.push({
        sourceIndex,
        message: `“${column?.name ?? "That column"}” is already taken by “${nameOf(sources[0] ?? 0)}”`,
      });
    }
  }

  const taken = new Set(columns.map((column) => normalizeName(column.name)));
  const created = new Map<string, number>();

  for (const draft of newColumnDrafts(mappings)) {
    const trimmed = draft.name.trim();

    if (trimmed.length === 0) {
      conflicts.push({ sourceIndex: draft.sourceIndex, message: "A new column needs a name" });
      continue;
    }

    const key = normalizeName(trimmed);

    if (taken.has(key)) {
      conflicts.push({
        sourceIndex: draft.sourceIndex,
        message: `The board already has a column called “${trimmed}” — map onto it instead`,
      });
      continue;
    }

    const first = created.get(key);
    if (first !== undefined) {
      conflicts.push({
        sourceIndex: draft.sourceIndex,
        message: `“${nameOf(first)}” is already creating a column called “${trimmed}”`,
      });
      continue;
    }

    created.set(key, draft.sourceIndex);
  }

  return conflicts;
}

/* ------------------------------------------------------------ validation */

export interface PlanInput {
  readonly source: ImportSource;
  readonly mappings: readonly ColumnMapping[];
  readonly columns: readonly BoardColumn[];
  readonly context?: CellContext;
}

/**
 * The columns planning parses against: the board's, plus a stand-in for each
 * one this import would create.
 */
export function planColumns(
  mappings: readonly ColumnMapping[],
  columns: readonly BoardColumn[],
): readonly BoardColumn[] {
  const provisional = newColumnDrafts(mappings).map((draft, offset) =>
    makeColumn(
      provisionalColumnId(draft.sourceIndex),
      draft.name.trim(),
      draft.type,
      columns.length + offset,
    ),
  );

  return provisional.length === 0 ? columns : [...columns, ...provisional];
}

/**
 * Parse every mapped cell and report, per row, what the column could not read.
 * Nothing is written and nothing is thrown — an unparsable date is a finding,
 * not a failure.
 *
 * A row is dropped only when the *whole source row* is empty. Emptiness is a
 * property of the row in the file, not of the columns that happen to be mapped:
 * deciding it per mapped column made a row that carried data the user chose not
 * to import disappear, taking its row number with it.
 */
export function planImport({ source, mappings, columns, context = {} }: PlanInput): ImportPlan {
  const resolved = planColumns(mappings, columns);
  const byId = new Map(resolved.map((column) => [column.id, column]));

  const active = mappings.flatMap((mapping) => {
    if (mapping.target.kind === "existing") {
      return [{ sourceIndex: mapping.sourceIndex, columnId: mapping.target.columnId }];
    }
    if (mapping.target.kind === "create") {
      return [{ sourceIndex: mapping.sourceIndex, columnId: provisionalColumnId(mapping.sourceIndex) }];
    }
    return [];
  });

  const drafts: ImportDraftRow[] = [];
  const issues: ImportIssue[] = [];
  let blankCount = 0;

  for (const row of source.rows) {
    // Whole-row emptiness, decided before anything is mapped.
    if (row.cells.every((cell) => cell.trim().length === 0)) {
      blankCount += 1;
      continue;
    }

    const rowNumber = row.sourceRowNumber;
    const cells: Record<string, CellValue> = {};
    const invalidColumnIds: string[] = [];

    for (const mapping of active) {
      const column = byId.get(mapping.columnId);
      if (!column) continue;

      const raw = row.cells[mapping.sourceIndex] ?? "";
      const result = parseTextIntoCell(raw, column, context);

      // An empty source cell stays empty. It is never filled from a
      // neighbouring row, and it never causes the row to be dropped.
      cells[column.id] = result.value;
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

    drafts.push({ rowNumber, cells, invalidColumnIds });
  }

  const invalidCount = drafts.filter((draft) => draft.invalidColumnIds.length > 0).length;

  return {
    drafts,
    issues,
    mappedColumnCount: active.length,
    newColumnCount: newColumnDrafts(mappings).length,
    validCount: drafts.length - invalidCount,
    invalidCount,
    blankCount,
    conflicts: mappingConflicts(mappings, columns, source.headers),
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
 * The records the import will actually create, in the file's own row order.
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

/**
 * Re-key the drafted cells once the board has handed back the real columns.
 *
 * The plan was computed against provisional ids; this is the one place they
 * turn into the ids the board issued, and it happens after the columns exist
 * and before any record is written.
 */
export function resolveProvisionalIds(
  rows: readonly Readonly<Record<string, CellValue>>[],
  realIdBySourceIndex: ReadonlyMap<number, string>,
): readonly Readonly<Record<string, CellValue>>[] {
  if (realIdBySourceIndex.size === 0) return rows;

  const rename = new Map(
    [...realIdBySourceIndex].map(([sourceIndex, realId]) => [
      provisionalColumnId(sourceIndex),
      realId,
    ]),
  );

  return rows.map((cells) =>
    Object.fromEntries(
      Object.entries(cells).flatMap(([columnId, value]) => {
        if (!isProvisionalColumnId(columnId)) return [[columnId, value] as const];

        const realId = rename.get(columnId);
        // A provisional id with no real column behind it means the column was
        // never created; dropping the cell is right, inventing one is not.
        return realId ? [[realId, value] as const] : [];
      }),
    ),
  );
}
