import type { RowMap } from "@/lib/board-records";
import { cellOf } from "@/lib/cell-values";
import type { BoardColumn, BoardColumnOf, BoardRow, SubtaskDisplay } from "@/types";

/**
 * Parent/child hierarchy over the shared record set.
 *
 * A subtask is an ordinary board record that happens to name a parent, so
 * everything here works on `parentRowId` alone — no nested arrays, no second
 * copy of a record, and no depth limit. `TASK-002` can own `TASK-006` the day
 * someone needs it, and every helper below already walks that far.
 *
 * Hierarchy is not Relation. "Blocked by" is a relation *column* holding row
 * ids, and it keeps working exactly as it did: TASK-003 blocked by TASK-002 is
 * a dependency, TASK-001 containing TASK-002 is containment. The two live side
 * by side and never read each other's data.
 */

export const NO_PARENT = null;

export function parentIdOf(row: BoardRow | undefined): string | null {
  return row?.parentRowId ?? null;
}

export function isSubtask(row: BoardRow | undefined): boolean {
  return parentIdOf(row) !== null;
}

/** Child ids per parent, in board order. Built once per render, not per row. */
export interface HierarchyIndex {
  /** Parent row id → its children, in `rowOrder` sequence. */
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  /** Ids with no parent, or whose parent is not on this board any more. */
  readonly rootIds: readonly string[];
}

export const EMPTY_HIERARCHY: HierarchyIndex = {
  childrenByParent: new Map(),
  rootIds: [],
};

/**
 * Index the whole board.
 *
 * A record whose parent has been deleted is treated as a root rather than
 * disappearing: an orphan must still be reachable, or it becomes invisible
 * data.
 */
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

/** Every descendant, depth-first. Guarded so a cyclic write cannot hang a render. */
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

/** Ancestors from the immediate parent upward. Cycle-safe for the same reason. */
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

/**
 * Would making `rowId` a child of `parentId` close a loop?
 *
 * Re-parenting is the one write that can corrupt the tree, so the check lives
 * next to the data rather than in whichever component happens to offer the move.
 */
export function wouldCreateCycle(
  rowsById: RowMap,
  rowId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return false;
  if (parentId === rowId) return true;

  return ancestorIdsOf(rowsById, parentId).includes(rowId);
}

/* ------------------------------------------------------------- completion */

/**
 * Completion is configuration, not a guess.
 *
 * A select column marks which of its options mean "finished"
 * (`config.completedOptionIds`), and the first column that declares any is the
 * one progress is measured against. Nothing here reads a label, so renaming
 * "Done" to "Shipped" changes nothing.
 */
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
  /** 0 – 1, and 0 when there is nothing to measure. */
  readonly ratio: number;
  /** Rounded to whole percent — what the label prints. */
  readonly percent: number;
  /** False when no column declares completed options; the bar is then hidden. */
  readonly isMeasurable: boolean;
}

export const NO_PROGRESS: SubtaskProgress = {
  total: 0,
  completed: 0,
  ratio: 0,
  percent: 0,
  isMeasurable: false,
};

/** `2 / 5 completed · 40%` for one parent's direct children. */
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

/* ---------------------------------------------------------------- reading */

export const DEFAULT_SUBTASK_DISPLAY: SubtaskDisplay = "nested";

export function subtaskDisplayOf(display: SubtaskDisplay | undefined): SubtaskDisplay {
  return display ?? DEFAULT_SUBTASK_DISPLAY;
}

export const SUBTASK_DISPLAY_LABELS: Readonly<Record<SubtaskDisplay, string>> = {
  nested: "Show subtasks nested",
  flat: "Show subtasks as normal rows",
  hidden: "Hide subtasks",
};

/** One record in a hierarchy listing: its id, how deep it sits, what it owns. */
export interface HierarchyEntry {
  readonly rowId: string;
  readonly depth: number;
  readonly childCount: number;
  readonly hasChildren: boolean;
  readonly isCollapsed: boolean;
}

export interface HierarchyLayoutInput {
  /** Row ids the view already resolved — filtered, searched and sorted. */
  readonly rowIds: readonly string[];
  readonly rowsById: RowMap;
  readonly index: HierarchyIndex;
  readonly display: SubtaskDisplay;
  readonly collapsed: ReadonlySet<string>;
}

/**
 * Turn the view's flat row ids into what the table should actually render.
 *
 * `flat` and `hidden` are pure filters over the same list, so ordering, sorting
 * and grouping keep working untouched. `nested` re-walks the list as a tree:
 * a parent brings its (visible) children with it, indented, and a collapsed
 * parent contributes only itself.
 *
 * A child whose parent was filtered out is promoted to the top level rather
 * than vanishing — a filter narrows what you see, it does not delete records.
 */
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
    // Roots, and orphans whose parent this view is not showing, start a branch.
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
