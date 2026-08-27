import { addDays, dayIndex, daysBetween, startOfDay } from "@/lib/board-dates";
import {
  childIdsOf,
  descendantIdsOf,
  isRowCompleted,
  subtaskProgress,
  type HierarchyEntry,
  type HierarchyIndex,
  type SubtaskProgress,
} from "@/lib/board-hierarchy";
import type { RowMap } from "@/lib/board-records";
import { cellOf } from "@/lib/cell-values";
import type { BoardColumn, BoardColumnOf, CellEdit } from "@/types";

/**
 * Gantt rows over the shared board records.
 *
 * There is no Gantt task list. Every line here is a board record read through
 * the same hierarchy the table nests with, scheduled by whichever two Date
 * columns the view names — so a date changed in the grid or the drawer is the
 * same write, and every view sees it on the next frame. The chart itself only
 * ever reads — see `gantt-board` for why it does not reschedule.
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

/**
 * What a line on the chart is.
 *
 * There is no milestone kind, and deliberately so. A milestone is a record the
 * user declared to be one; this board has no such field, and inferring it from
 * "start and end fall on the same day" would turn every one-day task into a
 * diamond — which is exactly how a Gantt stops showing duration. Until the
 * record can say it, everything scheduled is a bar.
 */
export type GanttBarKind =
  /** Scheduled on the record itself. */
  | "task"
  /** No dates of its own; the range its subtasks occupy. Derived, read-only. */
  | "summary";

/** Why a record could not be placed on the chart. */
export type GanttGap =
  /** Neither date is set. */
  | "none"
  /** One date is set — a duration needs both. */
  | "partial"
  /** The start is after the end. */
  | "inverted";

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
  /** Null when the record cannot be placed — those are listed, not dropped. */
  readonly schedule: GanttSchedule | null;
  readonly kind: GanttBarKind;
  /** True when the range came from the children rather than the record. */
  readonly isDerived: boolean;
  /** Set only on unscheduled rows, saying which date is missing or wrong. */
  readonly gap: GanttGap | null;
  readonly progress: SubtaskProgress | null;
  /**
   * 0 – 1 of the bar drawn at full strength.
   *
   * A parent takes the share of its subtasks that are finished; a leaf is
   * finished or it is not, so it is 1 or 0. Both read off the same completed
   * options the board already declares — nothing new is stored, and a board
   * with no completion column simply has no denser part to draw.
   */
  readonly completionRatio: number;
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

    const measured = progress && progress.isMeasurable ? progress : null;

    const base = {
      rowId,
      depth: entry.depth,
      hasChildren: entry.hasChildren,
      childCount: entry.childCount,
      isCollapsed: entry.isCollapsed,
      progress: measured,
      completionRatio: measured
        ? measured.ratio
        : isRowCompleted(input.rowsById[rowId], input.completionColumn)
          ? 1
          : 0,
    };

    // A start after its end is a mistake in the data. It is reported, not
    // silently reordered — swapping it would hide the error and rewrite what
    // the user actually typed.
    if (rawStart && rawEnd && dayIndex(rawStart) > dayIndex(rawEnd)) {
      unscheduled.push({ ...base, schedule: null, kind: "task", isDerived: false, gap: "inverted" });
      continue;
    }

    if (rawStart && rawEnd) {
      scheduled.push({
        ...base,
        schedule: scheduleOf(rawStart, rawEnd, input.rangeStartIso),
        kind: "task",
        isDerived: false,
        gap: null,
      });
      continue;
    }

    /**
     * One date is not a duration.
     *
     * Drawing a single-day bar from a lone start date invents an end the record
     * never claimed, and every such record then looks identical to a real
     * one-day task. The honest answer is that the schedule is incomplete, so it
     * is listed as such and the missing date is named.
     */
    if (rawStart || rawEnd) {
      unscheduled.push({ ...base, schedule: null, kind: "task", isDerived: false, gap: "partial" });
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
        gap: null,
      });
      continue;
    }

    unscheduled.push({ ...base, schedule: null, kind: "task", isDerived: false, gap: "none" });
  }

  return { scheduled, unscheduled };
}

/* ------------------------------------------------------------ filling in */

/** How long a filled-in schedule runs when the record only knows one end. */
export const DEFAULT_SPAN_DAYS = 3;

export interface ScheduleFill {
  readonly startIso: string;
  readonly endIso: string;
}

/**
 * The dates an incomplete record *would* be given.
 *
 * The chart never applies this on its own. Writing dates onto records because
 * they were missing would rewrite the plan the moment someone opened a view,
 * and a chart is not entitled to do that — so this stays a pure calculation
 * that the "Fill dates" action turns into an ordinary, undoable cell edit.
 *
 * What is known is kept: a record that already has a start keeps it and gains
 * an end measured from it, so filling in never moves a date the user typed.
 * Returns null when nothing is missing, and refuses an inverted range, whose
 * correct repair is ambiguous — only the author knows which end was the typo.
 */
export function fillScheduleFor(
  startIso: string | null,
  endIso: string | null,
  todayIso: string,
): ScheduleFill | null {
  if (startIso && endIso) return null;

  const span = DEFAULT_SPAN_DAYS - 1;
  if (startIso) return { startIso, endIso: addDays(startIso, span) };
  if (endIso) return { startIso: addDays(endIso, -span), endIso };

  const today = startOfDay(todayIso);
  return { startIso: today, endIso: addDays(today, span) };
}

/**
 * Cell edits that put every fillable row on the chart, as one write.
 *
 * Only the missing half of a range is written — the present one is read back
 * and passed through untouched, so the edit is additive rather than a reset.
 */
export function fillScheduleEdits(
  rows: readonly GanttRow[],
  rowsById: RowMap,
  startColumn: BoardColumn | null,
  endColumn: BoardColumn | null,
  todayIso: string,
): readonly CellEdit[] {
  if (!startColumn || !endColumn) return [];

  const edits: CellEdit[] = [];

  for (const row of rows) {
    const start = readDate(row.rowId, rowsById, startColumn);
    const end = readDate(row.rowId, rowsById, endColumn);

    const fill = fillScheduleFor(start, end, todayIso);
    if (!fill) continue;

    if (!start) {
      edits.push({
        rowId: row.rowId,
        columnId: startColumn.id,
        value: { kind: "date", iso: fill.startIso },
      });
    }
    if (!end) {
      edits.push({
        rowId: row.rowId,
        columnId: endColumn.id,
        value: { kind: "date", iso: fill.endIso },
      });
    }
  }

  return edits;
}

/** Rows the fill action can actually complete — an inverted range is not one. */
export function fillableRows(rows: readonly GanttRow[]): readonly GanttRow[] {
  return rows.filter((row) => row.gap === "none" || row.gap === "partial");
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

/** Whole days a range covers, both ends included — a bar is never zero wide. */
export function spanDays(startIso: string, endIso: string): number {
  return Math.max(1, daysBetween(startIso, endIso) + 1);
}

