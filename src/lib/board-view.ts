import { isRowArchived } from "@/lib/archive";
import { cellOf, cellSortKey, cellText, isCellEmpty, type CellContext } from "@/lib/cell-values";
import { clampColumnWidth } from "@/lib/board-schema";
import type { RowMap } from "@/lib/board-records";
import type {
  Board,
  BoardColumn,
  BoardRow,
  CellValue,
  SavedView,
  ViewFilter,
  ViewSort,
} from "@/types";

/**
 * A view never owns records — it describes how to read the board's.
 *
 * Schema (name, type, config) lives on the column and is shared by every view.
 * Presentation (order, width, visibility) is per view, so hiding a column in
 * the table cannot change what Kanban or Calendar show.
 */

/** Columns in view order, with per-view width and visibility applied. */
export function resolveColumns(board: Board, view: SavedView | null): readonly BoardColumn[] {
  const byPosition = [...board.columns].sort((a, b) => a.position - b.position);
  if (!view) return byPosition;

  const rank = new Map(view.columnOrder.map((id, index) => [id, index]));
  const hidden = new Set(view.hiddenColumnIds);

  return byPosition
    .map((column) => {
      const width = view.columnWidths[column.id];
      const isHidden = !column.isPrimary && (hidden.has(column.id) || column.hidden);

      return width === undefined && isHidden === column.hidden
        ? column
        : { ...column, width: width === undefined ? column.width : clampColumnWidth(width), hidden: isHidden };
    })
    .sort((a, b) => (rank.get(a.id) ?? a.position + 1000) - (rank.get(b.id) ?? b.position + 1000));
}

export function visibleColumns(columns: readonly BoardColumn[]): readonly BoardColumn[] {
  return columns.filter((column) => !column.hidden);
}

/* ----------------------------------------------------------------- filters */

export function matchesFilter(
  row: BoardRow,
  filter: ViewFilter,
  column: BoardColumn,
  context: CellContext,
): boolean {
  const value = cellOf(row, column);

  if (filter.operator === "isEmpty") return isCellEmpty(value);
  if (filter.operator === "isNotEmpty") return !isCellEmpty(value);

  if (value.kind === "date") return matchesDate(value.iso, filter);

  // Identity types compare against the stored id first, then the label, so a
  // filter written by the UI (an id) and one written by hand (a name) agree.
  if (value.kind === "select" || value.kind === "user" || value.kind === "relation") {
    const ids = idsOf(value);
    const needle = filter.value.trim().toLowerCase();
    const label = cellText(value, column, context).toLowerCase();

    const isSubstring = filter.operator === "contains" || filter.operator === "notContains";
    const hit =
      ids.some((id) => id.toLowerCase() === needle) ||
      label === needle ||
      (isSubstring && label.includes(needle));

    switch (filter.operator) {
      case "is":
      case "contains":
        return hit;
      case "isNot":
      case "notContains":
        return !hit;
      default:
        return true;
    }
  }

  const text = cellText(value, column, context).toLowerCase();
  const needle = filter.value.trim().toLowerCase();

  switch (filter.operator) {
    case "contains":
      return text.includes(needle);
    case "notContains":
      return !text.includes(needle);
    case "is":
      return text === needle;
    case "isNot":
      return text !== needle;
    default:
      return true;
  }
}

function idsOf(value: CellValue): readonly string[] {
  if (value.kind === "select") return value.optionIds;
  if (value.kind === "user") return value.userIds;
  if (value.kind === "relation") return value.rowIds;
  return [];
}

/** Date conditions compare calendar days, not instants. */
function matchesDate(iso: string | null, filter: ViewFilter): boolean {
  if (!iso) return false;

  const bound = Date.parse(filter.value);
  if (Number.isNaN(bound)) return true;

  const day = dayNumber(iso);
  const boundDay = dayNumber(new Date(bound).toISOString());

  switch (filter.operator) {
    case "is":
      return day === boundDay;
    case "before":
      return day < boundDay;
    case "after":
      return day > boundDay;
    case "onOrBefore":
      return day <= boundDay;
    case "onOrAfter":
      return day >= boundDay;
    default:
      return true;
  }
}

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(iso.slice(0, 10)) / 86_400_000);
}

/* -------------------------------------------------------------------- sort */

export function compareRows(
  a: BoardRow,
  b: BoardRow,
  sorts: readonly ViewSort[],
  columns: ReadonlyMap<string, BoardColumn>,
  context: CellContext,
): number {
  for (const sort of sorts) {
    const column = columns.get(sort.columnId);
    if (!column) continue;

    const left = cellSortKey(cellOf(a, column), column, context);
    const right = cellSortKey(cellOf(b, column), column, context);

    // Empty always sinks, whichever direction the sort runs.
    if (left.isEmpty !== right.isEmpty) return left.isEmpty ? 1 : -1;
    if (left.isEmpty) continue;

    const order = compareKeys(left.key, right.key);
    if (order !== 0) return sort.direction === "asc" ? order : -order;
  }

  return 0;
}

function compareKeys(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/* ------------------------------------------------------------------ apply */

export interface ViewQueryInput {
  readonly view: SavedView | null;
  readonly rowsById: RowMap;
  readonly rowOrder: readonly string[];
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  /** Free-text search across every visible column. */
  readonly search?: string;
  /**
   * Archived records are frozen, not deleted: they stay out of every view
   * until the board is explicitly asked to show them (SY-ARC-37).
   */
  readonly includeArchived?: boolean;
}

/**
 * The single query the whole board runs: filters, then search, then sort.
 * Table, Kanban, Calendar and Timeline all consume the row ids it returns.
 */
export function queryRowIds({
  view,
  rowsById,
  rowOrder,
  columns,
  context,
  search = "",
  includeArchived = false,
}: ViewQueryInput): readonly string[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const filters = (view?.filters ?? []).filter((filter) => byId.has(filter.columnId));
  const needle = search.trim().toLowerCase();

  const rows: BoardRow[] = [];

  for (const rowId of rowOrder) {
    const row = rowsById[rowId];
    if (!row) continue;
    if (!includeArchived && isRowArchived(row)) continue;

    const test = (filter: ViewFilter) => {
      const column = byId.get(filter.columnId);
      return column ? matchesFilter(row, filter, column, context) : true;
    };

    const passesFilters =
      filters.length === 0 ||
      (view?.filterConjunction === "or" ? filters.some(test) : filters.every(test));

    if (!passesFilters) continue;

    if (needle.length > 0 && !rowMatchesSearch(row, columns, context, needle)) continue;

    rows.push(row);
  }

  const sorts = (view?.sorts ?? []).filter((sort) => byId.has(sort.columnId));
  if (sorts.length > 0) {
    rows.sort((a, b) => compareRows(a, b, sorts, byId, context));
  }

  return rows.map((row) => row.id);
}

function rowMatchesSearch(
  row: BoardRow,
  columns: readonly BoardColumn[],
  context: CellContext,
  needle: string,
): boolean {
  if (row.displayId.toLowerCase().includes(needle)) return true;

  return columns.some((column) =>
    cellText(cellOf(row, column), column, context).toLowerCase().includes(needle),
  );
}

/** Drop filters and sorts that point at a column the schema no longer has. */
/**
 * Drop every reference to a column the schema no longer has — filters, sorts,
 * grouping and the calendar/timeline anchors. The view survives the deletion
 * instead of rendering against a column that is gone.
 */
export function pruneView(view: SavedView, columns: readonly BoardColumn[]): SavedView {
  const ids = new Set(columns.map((column) => column.id));
  const keep = (id: string | null) => (id !== null && ids.has(id) ? id : null);

  const filters = view.filters.filter((filter) => ids.has(filter.columnId));
  const sorts = view.sorts.filter((sort) => ids.has(sort.columnId));
  const columnOrder = view.columnOrder.filter((id) => ids.has(id));
  const hiddenColumnIds = view.hiddenColumnIds.filter((id) => ids.has(id));

  // Presentation keyed by column id has to go the same way as the rest: a view
  // that still names a deleted column is a view carrying a dead reference.
  const columnDisplay = Object.fromEntries(
    Object.entries(view.columnDisplay ?? {}).filter(([id]) => ids.has(id)),
  );
  const columnWidths = Object.fromEntries(
    Object.entries(view.columnWidths).filter(([id]) => ids.has(id)),
  );
  const groupByColumnId = keep(view.groupByColumnId);
  const dateColumnId = keep(view.dateColumnId);
  const endDateColumnId = keep(view.endDateColumnId);

  const unchanged =
    filters.length === view.filters.length &&
    sorts.length === view.sorts.length &&
    columnOrder.length === view.columnOrder.length &&
    hiddenColumnIds.length === view.hiddenColumnIds.length &&
    Object.keys(columnDisplay).length === Object.keys(view.columnDisplay ?? {}).length &&
    Object.keys(columnWidths).length === Object.keys(view.columnWidths).length &&
    groupByColumnId === view.groupByColumnId &&
    dateColumnId === view.dateColumnId &&
    endDateColumnId === view.endDateColumnId;

  return unchanged
    ? view
    : {
        ...view,
        filters,
        sorts,
        columnOrder,
        hiddenColumnIds,
        columnDisplay,
        columnWidths,
        groupByColumnId,
        dateColumnId,
        endDateColumnId,
      };
}
