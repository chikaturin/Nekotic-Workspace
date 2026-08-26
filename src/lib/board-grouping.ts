import { cellOf, cellText, isCellEmpty, type CellContext } from "@/lib/cell-values";
import type { RowMap } from "@/lib/board-records";
import type { BoardColumn, CellValue, SelectColor } from "@/types";

/**
 * Grouping over the shared record set.
 *
 * The same function feeds the table's collapsible blocks and Kanban's columns —
 * a Kanban column *is* a group. Neither owns records; both name row ids.
 */

/** Bucket for records whose group value is empty. */
export const UNGROUPED_KEY = "__ungrouped__";

export interface GroupBucket {
  readonly key: string;
  readonly label: string;
  readonly color?: SelectColor;
}

export interface RowGroup extends GroupBucket {
  readonly rowIds: readonly string[];
}

/** Which value puts a row in a group. Multi-value cells group by their first. */
export function groupKeyOf(
  rowId: string,
  rows: RowMap,
  column: BoardColumn,
): string {
  const row = rows[rowId];
  if (!row) return UNGROUPED_KEY;

  const value = cellOf(row, column);
  if (isCellEmpty(value)) return UNGROUPED_KEY;

  switch (value.kind) {
    case "select":
      return value.optionIds[0] ?? UNGROUPED_KEY;
    case "user":
      return value.userIds[0] ?? UNGROUPED_KEY;
    case "date":
      return value.iso ? value.iso.slice(0, 10) : UNGROUPED_KEY;
    default:
      return cellText(value, column).trim() || UNGROUPED_KEY;
  }
}

/**
 * Every bucket a column can produce, in a meaningful order — option order for
 * a select, directory order for a user. Kanban needs the empty ones too, which
 * is why the catalog is derived from the schema and not from the records.
 */
export function bucketsFor(column: BoardColumn, context: CellContext): readonly GroupBucket[] {
  if (column.type === "select") {
    return column.config.options.map((option) => ({
      key: option.id,
      label: option.label,
      color: option.color,
    }));
  }

  if (column.type === "user") {
    return [...(context.people?.values() ?? [])].map((person) => ({
      key: person.id,
      label: person.isActive ? person.name : `${person.name} (inactive)`,
    }));
  }

  return [];
}

export const UNGROUPED_BUCKET: GroupBucket = { key: UNGROUPED_KEY, label: "No value" };

export interface GroupOptions {
  /** Drop buckets that hold no records. The ungrouped bucket follows the same rule. */
  readonly hideEmpty?: boolean;
}

/**
 * Split ordered row ids into groups. Row order inside a group is the order it
 * arrived in, so filters and sorts stay in charge of sequencing.
 */
export function buildGroups(
  rowIds: readonly string[],
  rows: RowMap,
  column: BoardColumn,
  context: CellContext,
  options: GroupOptions = {},
): readonly RowGroup[] {
  const byKey = new Map<string, string[]>();

  for (const rowId of rowIds) {
    const key = groupKeyOf(rowId, rows, column);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(rowId);
    else byKey.set(key, [rowId]);
  }

  const catalog = bucketsFor(column, context);
  const known = new Set(catalog.map((bucket) => bucket.key));

  // Values outside the catalog (free text, a stale option id) still get a group.
  const extra: GroupBucket[] = [...byKey.keys()]
    .filter((key) => key !== UNGROUPED_KEY && !known.has(key))
    .map((key) => ({ key, label: labelForKey(key, column, context) }));

  const ordered: readonly GroupBucket[] =
    catalog.length > 0 ? [...catalog, ...extra, UNGROUPED_BUCKET] : [...extra, UNGROUPED_BUCKET];

  return ordered
    .map((bucket) => ({ ...bucket, rowIds: byKey.get(bucket.key) ?? [] }))
    .filter((group) => !options.hideEmpty || group.rowIds.length > 0);
}

function labelForKey(key: string, column: BoardColumn, context: CellContext): string {
  if (column.type === "user") return context.people?.get(key)?.name ?? key;
  return key;
}

/**
 * The cell value that puts a record into `groupKey` — what a Kanban drop
 * writes. Returns null for columns that cannot be set by grouping alone.
 */
export function groupValueFor(column: BoardColumn, groupKey: string): CellValue | null {
  const isEmptyBucket = groupKey === UNGROUPED_KEY;

  if (column.type === "select") {
    return { kind: "select", optionIds: isEmptyBucket ? [] : [groupKey] };
  }
  if (column.type === "user") {
    return { kind: "user", userIds: isEmptyBucket ? [] : [groupKey] };
  }

  return null;
}

/* ------------------------------------------------------ table flattening */

export type FlatRow =
  | {
      readonly kind: "group";
      readonly key: string;
      readonly label: string;
      readonly color?: SelectColor;
      readonly count: number;
      readonly isCollapsed: boolean;
    }
  | { readonly kind: "record"; readonly rowId: string; readonly recordIndex: number };

export interface FlattenedGroups {
  /** Group headers and records interleaved — what the virtualiser renders. */
  readonly flat: readonly FlatRow[];
  /** Records in display order — what selection and the keyboard address. */
  readonly rowIds: readonly string[];
  /** Position of each record inside `flat`, for scroll-into-view. */
  readonly flatIndexByRecord: readonly number[];
}

/**
 * Turn groups into one uniform-height list. Collapsed groups contribute their
 * header and nothing else, so collapsing is instant at any record count.
 */
export function flattenGroups(
  groups: readonly RowGroup[],
  collapsed: ReadonlySet<string>,
): FlattenedGroups {
  const flat: FlatRow[] = [];
  const rowIds: string[] = [];
  const flatIndexByRecord: number[] = [];

  for (const group of groups) {
    const isCollapsed = collapsed.has(group.key);

    flat.push({
      kind: "group",
      key: group.key,
      label: group.label,
      ...(group.color ? { color: group.color } : {}),
      count: group.rowIds.length,
      isCollapsed,
    });

    if (isCollapsed) continue;

    for (const rowId of group.rowIds) {
      flatIndexByRecord.push(flat.length);
      flat.push({ kind: "record", rowId, recordIndex: rowIds.length });
      rowIds.push(rowId);
    }
  }

  return { flat, rowIds, flatIndexByRecord };
}

/** The ungrouped shape, so the grid can take one code path either way. */
export function flattenUngrouped(rowIds: readonly string[]): FlattenedGroups {
  return {
    flat: rowIds.map((rowId, recordIndex) => ({ kind: "record" as const, rowId, recordIndex })),
    rowIds,
    flatIndexByRecord: rowIds.map((_, index) => index),
  };
}
