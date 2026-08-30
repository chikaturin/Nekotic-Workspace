import type { HierarchyEntry } from "@/lib/board-hierarchy";
import { cellOf, cellText, isCellEmpty, type CellContext } from "@/lib/cell-values";
import type { RowMap } from "@/lib/board-records";
import type { BoardColumn, CellValue, SelectColor } from "@/types";

export const UNGROUPED_KEY = "__ungrouped__";

export interface GroupBucket {
  readonly key: string;
  readonly label: string;
  readonly color?: SelectColor;
}

export interface RowGroup extends GroupBucket {
  readonly rowIds: readonly string[];
}

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
  readonly hideEmpty?: boolean;
}

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

export type FlatRow =
  | {
      readonly kind: "group";
      readonly key: string;
      readonly label: string;
      readonly color?: SelectColor;
      readonly count: number;
      readonly isCollapsed: boolean;
    }
  | {
      readonly kind: "record";
      readonly rowId: string;
      readonly recordIndex: number;
      readonly depth: number;
      readonly hasChildren: boolean;
      readonly childCount: number;
      readonly isCollapsed: boolean;
    };

export type RowExpander = (rowIds: readonly string[]) => readonly HierarchyEntry[];

const FLAT_EXPANDER: RowExpander = (rowIds) =>
  rowIds.map((rowId) => ({
    rowId,
    depth: 0,
    childCount: 0,
    hasChildren: false,
    isCollapsed: false,
  }));

export interface FlattenedGroups {
  readonly flat: readonly FlatRow[];
  readonly rowIds: readonly string[];
  readonly flatIndexByRecord: readonly number[];
}

export function flattenGroups(
  groups: readonly RowGroup[],
  collapsed: ReadonlySet<string>,
  expand: RowExpander = FLAT_EXPANDER,
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

    for (const entry of expand(group.rowIds)) {
      flatIndexByRecord.push(flat.length);
      flat.push({ kind: "record", recordIndex: rowIds.length, ...entry });
      rowIds.push(entry.rowId);
    }
  }

  return { flat, rowIds, flatIndexByRecord };
}

export function flattenUngrouped(
  rowIds: readonly string[],
  expand: RowExpander = FLAT_EXPANDER,
): FlattenedGroups {
  const entries = expand(rowIds);

  return {
    flat: entries.map((entry, recordIndex) => ({ kind: "record" as const, recordIndex, ...entry })),
    rowIds: entries.map((entry) => entry.rowId),
    flatIndexByRecord: entries.map((_, index) => index),
  };
}
