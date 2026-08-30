import { IMPORT_MAX_ROWS, IMPORT_SELECT_OPTION_LIMIT } from "@/config/app";
import { parseTextIntoCell } from "@/lib/cell-conversion";
import { isProtectedColumn, makeColumn, SELECT_COLORS } from "@/lib/board-schema";
import { importRefusalFor } from "@/lib/import-column-types";
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
  SelectOption,
} from "@/types";

export interface SourceInput {
  readonly fileName: string;
  readonly sheetName?: string | null;
  readonly grid: Grid;
  readonly hasHeaderRow: boolean;
}

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

export function isTruncated(grid: Grid, hasHeaderRow: boolean): boolean {
  return normalizeGrid(grid).length - (hasHeaderRow ? 1 : 0) > IMPORT_MAX_ROWS;
}

const NOISE = /[^a-z0-9]/g;

const normalizeName = (value: string): string => value.toLowerCase().replace(NOISE, "");

export const IGNORE: MappingTarget = { kind: "ignore" };

export function existingTarget(columnId: string): MappingTarget {
  return { kind: "existing", columnId };
}

export function createTarget(name: string, type: ColumnType): MappingTarget {
  return { kind: "create", name, type };
}

export function targetColumnId(mapping: ColumnMapping): string | null {
  return mapping.target.kind === "existing" ? mapping.target.columnId : null;
}

export function provisionalColumnId(sourceIndex: number): string {
  return `new_${sourceIndex}`;
}

export function isProvisionalColumnId(columnId: string): boolean {
  return columnId.startsWith("new_");
}

const DATE_NAME = /(^|[^a-z])(date|due|deadline|start|end|created|updated)([^a-z]|$)/i;
const LONG_NAME = /(step|description|note|notes|detail|details|summary|expected|actual|result)/i;

export function guessColumnType(header: string): ColumnType {
  if (DATE_NAME.test(header)) return "date";
  if (LONG_NAME.test(header)) return "longText";
  return "text";
}

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
            if (importRefusalFor(column) !== null) return false;

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

export function setMappingTarget(
  mappings: readonly ColumnMapping[],
  sourceIndex: number,
  target: MappingTarget,
): readonly ColumnMapping[] {
  return mappings.map((mapping) =>
    mapping.sourceIndex === sourceIndex ? { ...mapping, target } : mapping,
  );
}

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

export function unmappedBoardColumns(
  mappings: readonly ColumnMapping[],
  columns: readonly BoardColumn[],
): readonly BoardColumn[] {
  const written = new Set(mappings.map(targetColumnId).filter((id): id is string => id !== null));

  return columns.filter((column) => !written.has(column.id) && !isProtectedColumn(column));
}

export function newColumnDrafts(
  mappings: readonly ColumnMapping[],
): readonly { readonly sourceIndex: number; readonly name: string; readonly type: ColumnType }[] {
  return mappings.flatMap((mapping) =>
    mapping.target.kind === "create"
      ? [{ sourceIndex: mapping.sourceIndex, name: mapping.target.name, type: mapping.target.type }]
      : [],
  );
}

export function mappingConflicts(
  mappings: readonly ColumnMapping[],
  columns: readonly BoardColumn[],
  headers: readonly string[] = [],
  rows: readonly ImportSourceRow[] = [],
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

  // Quá ngần này giá trị khác nhau thì cột đó KHÔNG phải danh mục, và một bộ
  // chọn nghìn nhãn vô dụng y như một bộ chọn rỗng. Server áp đúng trần này.
  for (const draft of newColumnDrafts(mappings)) {
    if (draft.type !== "select") continue;

    const count = selectOptionsFrom(rows, draft.sourceIndex).length;
    if (count <= IMPORT_SELECT_OPTION_LIMIT) continue;

    conflicts.push({
      sourceIndex: draft.sourceIndex,
      message: `${count} different values is too many for a select column — import it as Text instead`,
    });
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

export interface PlanInput {
  readonly source: ImportSource;
  readonly mappings: readonly ColumnMapping[];
  readonly columns: readonly BoardColumn[];
  readonly context?: CellContext;
}

export function planColumns(
  mappings: readonly ColumnMapping[],
  columns: readonly BoardColumn[],
  rows: readonly ImportSourceRow[] = [],
): readonly BoardColumn[] {
  const provisional = newColumnDrafts(mappings).map((draft, offset) => {
    const column = makeColumn(
      provisionalColumnId(draft.sourceIndex),
      draft.name.trim(),
      draft.type,
      columns.length + offset,
    );

    // Cột Select mới lấy nhãn TỪ CHÍNH FILE — cùng một luật server chạy khi
    // ghi. Không dựng nhãn ở đây thì bản xem trước báo đỏ mọi dòng của một cột
    // mà lần ghi thật lại nhận hết.
    if (column.type !== "select") return column;

    return {
      ...column,
      config: {
        ...column.config,
        options: selectOptionsFrom(rows, draft.sourceIndex),
      },
    };
  });

  return provisional.length === 0 ? columns : [...columns, ...provisional];
}

/**
 * Nhãn của một cột Select do import dựng ra: các giá trị có trong file, bỏ
 * trống và gộp hoa thường.
 *
 * Gộp hoa thường vì lúc khớp cũng không phân biệt — để "Open" và "open" thành
 * hai nhãn thì nhãn thứ hai vĩnh viễn không ô nào trỏ tới.
 */
export function selectOptionsFrom(
  rows: readonly ImportSourceRow[],
  sourceIndex: number,
): readonly SelectOption[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const label = (row.cells[sourceIndex] ?? "").trim();
    const key = label.toLowerCase();

    if (label === "" || seen.has(key)) continue;

    seen.add(key);
    labels.push(label);
  }

  return labels.map((label, index) => ({
    id: `${provisionalColumnId(sourceIndex)}_opt_${index}`,
    label,
    color: SELECT_COLORS[index % SELECT_COLORS.length] as SelectOption["color"],
  }));
}

export function planImport({ source, mappings, columns, context = {} }: PlanInput): ImportPlan {
  const resolved = planColumns(mappings, columns, source.rows);
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
    conflicts: mappingConflicts(mappings, columns, source.headers, source.rows),
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
        return realId ? [[realId, value] as const] : [];
      }),
    ),
  );
}
