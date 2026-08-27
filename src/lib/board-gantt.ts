import { addDays, dayIndex, daysBetween, startOfDay } from "@/lib/board-dates";
import {
  childIdsOf,
  descendantIdsOf,
  subtaskProgress,
  type HierarchyEntry,
  type HierarchyIndex,
  type SubtaskProgress,
} from "@/lib/board-hierarchy";
import type { RowMap } from "@/lib/board-records";
import { cellOf } from "@/lib/cell-values";
import type { BoardColumn, BoardColumnOf } from "@/types";

/**
 * Gantt rows over the shared board records.
 *
 * There is no Gantt task list. Every line here is a board record read through
 * the same hierarchy the table nests with, scheduled by whichever two Date
 * columns the view names — so a date changed in the grid, the drawer or by
 * dragging a bar is the same write, and every view sees it on the next frame.
 *
 * Three things are *derived* and never written back:
 *
 *   - a parent's summary range, when it has no dates of its own,
 *   - progress, counted from the subtasks that are already records,
 *   - dependency conflicts, which warn and nothing more.
 *
 * Hierarchy and dependency stay separate throughout: containment comes from
 * `parentRowId`, "blocked by" from a relation column, and neither reads the
 * other's data.
 */

/** How wide a bar's grab zone is before it becomes a resize handle. */
export const RESIZE_HANDLE_PX = 8;

/** A drag has to travel this far before it stops being a click. */
export const DRAG_THRESHOLD_PX = 4;

export type GanttBarKind =
  /** Scheduled on the record itself, across more than one day. */
  | "bar"
  /** Scheduled on the record itself, on a single day — drawn as a diamond. */
  | "point"
  /** No dates of its own; the range its subtasks occupy. Not editable. */
  | "summary";

export interface GanttSchedule {
  readonly startIso: string;
  readonly endIso: string;
  /** Whole days from the chart's range start. */
  readonly offset: number;
  readonly span: number;
}

export interface GanttRow {
  readonly rowId: string;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly childCount: number;
  readonly isCollapsed: boolean;
  /** Null when the record has neither date — those go to Unscheduled. */
  readonly schedule: GanttSchedule | null;
  readonly kind: GanttBarKind;
  /** True when the range came from the children rather than the record. */
  readonly isDerived: boolean;
  /** The record names a start after its end — shown as an error, never fixed. */
  readonly isInvalid: boolean;
  /** Only one of the two dates is set; the bar covers that single day. */
  readonly isPartial: boolean;
  readonly progress: SubtaskProgress | null;
}

export interface GanttRowsInput {
  /** Hierarchy layout the view already resolved — filtered, sorted, nested. */
  readonly entries: readonly HierarchyEntry[];
  readonly rowsById: RowMap;
  readonly index: HierarchyIndex;
  readonly startColumn: BoardColumn | null;
  readonly endColumn: BoardColumn | null;
  readonly completionColumn: BoardColumnOf<"select"> | null;
  readonly rangeStartIso: string;
}

export interface GanttRows {
  /** Rows with a bar, in the view's own order. */
  readonly scheduled: readonly GanttRow[];
  /** Rows with neither date. Listed, never dropped. */
  readonly unscheduled: readonly GanttRow[];
}

function readDate(rowId: string, rows: RowMap, column: BoardColumn | null): string | null {
  if (!column) return null;

  const row = rows[rowId];
  if (!row) return null;

  const value = cellOf(row, column);
  if (value.kind !== "date" || value.iso === null) return null;

  // Gantt is a day-precision chart, so a timestamp is read as the day it
  // falls in — a bar cannot start at 13:37.
  return startOfDay(value.iso);
}

/** Earliest start and latest end across a record's whole subtree. */
function subtreeRange(
  rowId: string,
  input: GanttRowsInput,
): { readonly start: string; readonly end: string } | null {
  let min: string | null = null;
  let max: string | null = null;

  for (const childId of descendantIdsOf(input.index, rowId)) {
    const start = readDate(childId, input.rowsById, input.startColumn);
    const end = readDate(childId, input.rowsById, input.endColumn);

    for (const iso of [start, end]) {
      if (!iso) continue;
      if (!min || dayIndex(iso) < dayIndex(min)) min = iso;
      if (!max || dayIndex(iso) > dayIndex(max)) max = iso;
    }
  }

  return min && max ? { start: min, end: max } : null;
}

function scheduleOf(startIso: string, endIso: string, rangeStartIso: string): GanttSchedule {
  return {
    startIso,
    endIso,
    offset: daysBetween(rangeStartIso, startIso),
    span: Math.max(1, daysBetween(startIso, endIso) + 1),
  };
}

/**
 * Every visible line, split into the ones that sit on the chart and the ones
 * that have nowhere to sit yet.
 *
 * An unscheduled record is *listed*, not hidden: a task with no dates is the
 * one most likely to need them, and a chart that quietly drops it is a chart
 * that lies about what is on the board.
 */
export function buildGanttRows(input: GanttRowsInput): GanttRows {
  const scheduled: GanttRow[] = [];
  const unscheduled: GanttRow[] = [];

  for (const entry of input.entries) {
    const { rowId } = entry;
    const rawStart = readDate(rowId, input.rowsById, input.startColumn);
    const rawEnd = readDate(rowId, input.rowsById, input.endColumn);

    const childIds = childIdsOf(input.index, rowId);
    const progress =
      childIds.length > 0
        ? subtaskProgress(childIds, input.rowsById, input.completionColumn)
        : null;

    const base = {
      rowId,
      depth: entry.depth,
      hasChildren: entry.hasChildren,
      childCount: entry.childCount,
      isCollapsed: entry.isCollapsed,
      progress: progress && progress.isMeasurable ? progress : null,
    };

    // A start after its end is a mistake in the data. It is reported, not
    // silently reordered — swapping it would hide the error and rewrite what
    // the user actually typed.
    if (rawStart && rawEnd && dayIndex(rawStart) > dayIndex(rawEnd)) {
      unscheduled.push({
        ...base,
        schedule: null,
        kind: "bar",
        isDerived: false,
        isInvalid: true,
        isPartial: false,
      });
      continue;
    }

    if (rawStart || rawEnd) {
      const start = rawStart ?? rawEnd;
      const end = rawEnd ?? rawStart;
      if (!start || !end) continue;

      scheduled.push({
        ...base,
        schedule: scheduleOf(start, end, input.rangeStartIso),
        kind: start === end ? "point" : "bar",
        isDerived: false,
        isInvalid: false,
        isPartial: !rawStart || !rawEnd,
      });
      continue;
    }

    // No dates of its own: a parent still shows where its subtasks sit.
    const derived = entry.hasChildren ? subtreeRange(rowId, input) : null;
    if (derived) {
      scheduled.push({
        ...base,
        schedule: scheduleOf(derived.start, derived.end, input.rangeStartIso),
        kind: "summary",
        isDerived: true,
        isInvalid: false,
        isPartial: false,
      });
      continue;
    }

    unscheduled.push({
      ...base,
      schedule: null,
      kind: "bar",
      isDerived: false,
      isInvalid: false,
      isPartial: false,
    });
  }

  return { scheduled, unscheduled };
}

/* ------------------------------------------------------------ dependencies */

export interface GanttLink {
  /** The record that has to finish first. */
  readonly fromRowId: string;
  /** The record that says it is blocked. */
  readonly toRowId: string;
  /** The blocked record starts before its blocker ends. */
  readonly isConflict: boolean;
}

/** Relation columns are where "blocked by" lives — never the hierarchy. */
export function relationColumnsOf(columns: readonly BoardColumn[]): readonly BoardColumn[] {
  return columns.filter((column) => column.type === "relation");
}

/**
 * Links between rows that are both on the chart.
 *
 * A dependency pointing at a record this view filtered out is dropped rather
 * than drawn into empty space, and a record cannot block itself.
 *
 * A conflict is *reported*, never corrected. "Blocked by" states an intent
 * about order; it is not permission for the chart to move someone's dates.
 */
export function buildGanttLinks(
  rows: readonly GanttRow[],
  rowsById: RowMap,
  columns: readonly BoardColumn[],
): readonly GanttLink[] {
  const relations = relationColumnsOf(columns);
  if (relations.length === 0) return [];

  const byId = new Map(rows.map((row) => [row.rowId, row]));
  const links: GanttLink[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const record = rowsById[row.rowId];
    if (!record) continue;

    for (const column of relations) {
      const value = record.cells[column.id];
      if (!value || value.kind !== "relation") continue;

      for (const blockerId of value.rowIds) {
        if (blockerId === row.rowId) continue;

        const blocker = byId.get(blockerId);
        if (!blocker?.schedule || !row.schedule) continue;

        const key = `${blockerId}->${row.rowId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        links.push({
          fromRowId: blockerId,
          toRowId: row.rowId,
          isConflict: dayIndex(row.schedule.startIso) < dayIndex(blocker.schedule.endIso),
        });
      }
    }
  }

  return links;
}

/* -------------------------------------------------------------- drag maths */

export type GanttDragMode = "move" | "resize-start" | "resize-end";

/** Pixels travelled, as whole days. Day precision is the V1 contract. */
export function daysFromPixels(deltaX: number, dayWidth: number): number {
  if (dayWidth <= 0) return 0;
  return Math.round(deltaX / dayWidth);
}

/**
 * The range a drag would produce.
 *
 * Moving keeps the duration exactly — a bar dragged two days later starts and
 * ends two days later. Resizing moves one edge and is clamped at the other, so
 * a drag can never produce a start after its end.
 */
export function applyDrag(
  schedule: GanttSchedule,
  mode: GanttDragMode,
  days: number,
): { readonly startIso: string; readonly endIso: string } {
  if (mode === "move") {
    return { startIso: addDays(schedule.startIso, days), endIso: addDays(schedule.endIso, days) };
  }

  if (mode === "resize-start") {
    const next = addDays(schedule.startIso, days);
    const startIso = dayIndex(next) > dayIndex(schedule.endIso) ? schedule.endIso : next;
    return { startIso, endIso: schedule.endIso };
  }

  const next = addDays(schedule.endIso, days);
  const endIso = dayIndex(next) < dayIndex(schedule.startIso) ? schedule.startIso : next;
  return { startIso: schedule.startIso, endIso };
}

/** Whole days a range covers, both ends included — a bar is never zero wide. */
export function spanDays(startIso: string, endIso: string): number {
  return Math.max(1, daysBetween(startIso, endIso) + 1);
}

/** Whether a drag actually changed anything worth writing. */
export function hasMoved(
  schedule: GanttSchedule,
  next: { readonly startIso: string; readonly endIso: string },
): boolean {
  return schedule.startIso !== next.startIso || schedule.endIso !== next.endIso;
}
