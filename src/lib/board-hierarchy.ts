import type { RowMap } from "@/lib/board-records";
import { cellOf } from "@/lib/cell-values";
import type { BoardColumn, BoardColumnOf, BoardRow, SubtaskDisplay } from "@/types";

export const NO_PARENT = null;

export function parentIdOf(row: BoardRow | undefined): string | null {
  return row?.parentRowId ?? null;
}

export function isSubtask(row: BoardRow | undefined): boolean {
  return parentIdOf(row) !== null;
}

export interface HierarchyIndex {
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  readonly rootIds: readonly string[];
}

export const EMPTY_HIERARCHY: HierarchyIndex = {
  childrenByParent: new Map(),
  rootIds: [],
};

export function buildHierarchy(rowOrder: readonly string[], rowsById: RowMap): HierarchyIndex {
  const childrenByParent = new Map<string, string[]>();
  const rootIds: string[] = [];

  for (const rowId of rowOrder) {
    const row = rowsById[rowId];
    if (!row) continue;

    const parentId = parentIdOf(row);
    if (!parentId || !rowsById[parentId]) {
      rootIds.push(rowId);
      continue;
    }

    const bucket = childrenByParent.get(parentId);
    if (bucket) bucket.push(rowId);
    else childrenByParent.set(parentId, [rowId]);
  }

  return { childrenByParent, rootIds };
}

export function childIdsOf(index: HierarchyIndex, rowId: string): readonly string[] {
  return index.childrenByParent.get(rowId) ?? [];
}

export function hasChildren(index: HierarchyIndex, rowId: string): boolean {
  return childIdsOf(index, rowId).length > 0;
}

export function descendantIdsOf(index: HierarchyIndex, rowId: string): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const stack = [...childIdsOf(index, rowId)];

  while (stack.length > 0) {
    const next = stack.pop();
    if (!next || seen.has(next)) continue;

    seen.add(next);
    out.push(next);
    stack.push(...childIdsOf(index, next));
  }

  return out;
}

export function ancestorIdsOf(rowsById: RowMap, rowId: string): readonly string[] {
  const seen = new Set<string>([rowId]);
  const out: string[] = [];

  let current = parentIdOf(rowsById[rowId]);
  while (current && !seen.has(current)) {
    seen.add(current);
    out.push(current);
    current = parentIdOf(rowsById[current]);
  }

  return out;
}

export function wouldCreateCycle(
  rowsById: RowMap,
  rowId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return false;
  if (parentId === rowId) return true;

  return ancestorIdsOf(rowsById, parentId).includes(rowId);
}

export function completionColumnOf(
  columns: readonly BoardColumn[],
): BoardColumnOf<"select"> | null {
  for (const column of columns) {
    if (column.type !== "select") continue;
    if ((column.config.completedOptionIds ?? []).length > 0) return column;
  }
  return null;
}

export function isRowCompleted(
  row: BoardRow | undefined,
  column: BoardColumnOf<"select"> | null,
): boolean {
  if (!row || !column) return false;

  const value = cellOf(row, column);
  if (value.kind !== "select") return false;

  const completed = new Set(column.config.completedOptionIds ?? []);
  return value.optionIds.some((optionId) => completed.has(optionId));
}

export interface SubtaskProgress {
  readonly total: number;
  readonly completed: number;
  readonly ratio: number;
  readonly percent: number;
  readonly isMeasurable: boolean;
}

export const NO_PROGRESS: SubtaskProgress = {
  total: 0,
  completed: 0,
  ratio: 0,
  percent: 0,
  isMeasurable: false,
};

export function subtaskProgress(
  childIds: readonly string[],
  rowsById: RowMap,
  column: BoardColumnOf<"select"> | null,
): SubtaskProgress {
  if (childIds.length === 0) return NO_PROGRESS;

  const completed = childIds.filter((childId) => isRowCompleted(rowsById[childId], column)).length;
  const ratio = completed / childIds.length;

  return {
    total: childIds.length,
    completed,
    ratio,
    percent: Math.round(ratio * 100),
    isMeasurable: column !== null,
  };
}

export const DEFAULT_SUBTASK_DISPLAY: SubtaskDisplay = "nested";

export function subtaskDisplayOf(display: SubtaskDisplay | undefined): SubtaskDisplay {
  return display ?? DEFAULT_SUBTASK_DISPLAY;
}

export const SUBTASK_DISPLAY_LABELS: Readonly<Record<SubtaskDisplay, string>> = {
  nested: "Show subtasks nested",
  flat: "Show subtasks as normal rows",
  hidden: "Hide subtasks",
};

export interface HierarchyEntry {
  readonly rowId: string;
  readonly depth: number;
  readonly childCount: number;
  readonly hasChildren: boolean;
  readonly isCollapsed: boolean;
}

export interface HierarchyLayoutInput {
  readonly rowIds: readonly string[];
  readonly rowsById: RowMap;
  readonly index: HierarchyIndex;
  readonly display: SubtaskDisplay;
  readonly collapsed: ReadonlySet<string>;
}

export function layoutHierarchy({
  rowIds,
  rowsById,
  index,
  display,
  collapsed,
}: HierarchyLayoutInput): readonly HierarchyEntry[] {
  if (display === "hidden") {
    return rowIds
      .filter((rowId) => !isSubtask(rowsById[rowId]))
      .map((rowId) => entryFor(rowId, 0, index, collapsed));
  }

  if (display === "flat") {
    return rowIds.map((rowId) => entryFor(rowId, 0, index, collapsed));
  }

  const visible = new Set(rowIds);
  const emitted = new Set<string>();
  const out: HierarchyEntry[] = [];

  const walk = (rowId: string, depth: number) => {
    if (emitted.has(rowId)) return;
    emitted.add(rowId);
    out.push(entryFor(rowId, depth, index, collapsed));

    if (collapsed.has(rowId)) return;

    for (const childId of childIdsOf(index, rowId)) {
      if (visible.has(childId)) walk(childId, depth + 1);
    }
  };

  for (const rowId of rowIds) {
    const parentId = parentIdOf(rowsById[rowId]);
    if (!parentId || !visible.has(parentId) || !rowsById[parentId]) walk(rowId, 0);
  }

  return out;
}

function entryFor(
  rowId: string,
  depth: number,
  index: HierarchyIndex,
  collapsed: ReadonlySet<string>,
): HierarchyEntry {
  const children = childIdsOf(index, rowId);

  return {
    rowId,
    depth,
    childCount: children.length,
    hasChildren: children.length > 0,
    isCollapsed: collapsed.has(rowId),
  };
}
