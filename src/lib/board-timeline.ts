import {
  addDays,
  dayIndex,
  daysBetween,
  isFirstOfMonth,
  isoFromDayIndex,
  monthLabel,
  shortDayLabel,
  startOfDay,
  startOfWeek,
  weekdayIndex,
} from "@/lib/board-dates";
import { cellOf } from "@/lib/cell-values";
import type { RowMap } from "@/lib/board-records";
import type { BoardColumn, GanttZoom } from "@/types";

/**
 * Gantt geometry over the shared records.
 *
 * One unit is always a day; zoom only changes how many pixels a day is worth,
 * which keeps every offset in whole days and the maths exact.
 */

/**
 * Four scales over the same unit.
 *
 * Zoom never changes the arithmetic — a day is always one unit — only how many
 * pixels that day is drawn as. Day reads a sprint, quarter reads a year, and
 * every offset in between stays a whole number of days.
 */
export type TimelineZoom = GanttZoom;

export const TIMELINE_ZOOMS: readonly GanttZoom[] = ["day", "week", "month", "quarter"];

export const DAY_WIDTH: Readonly<Record<GanttZoom, number>> = {
  day: 44,
  week: 18,
  month: 7,
  quarter: 3,
};

export const ZOOM_LABELS: Readonly<Record<GanttZoom, string>> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
};

/** Where a zoom stops labelling every day and starts labelling periods. */
const TICK_STRIDE: Readonly<Record<GanttZoom, "day" | "week" | "month">> = {
  day: "day",
  week: "week",
  month: "month",
  quarter: "month",
};

/** Days of blank space kept on each side of the data. */
const PADDING_DAYS = 3;
const FALLBACK_SPAN_DAYS = 30;
const MIN_BAR_DAYS = 1;

export interface TimelineTick {
  readonly iso: string;
  readonly offset: number;
  readonly label: string;
  readonly isMajor: boolean;
}

export interface TimelineBar {
  readonly rowId: string;
  readonly startIso: string;
  readonly endIso: string;
  /** Whole days from the range start. */
  readonly offset: number;
  readonly span: number;
  /** True when the record's own start is after its end. */
  readonly isInverted: boolean;
  /** True when either end is missing and had to be inferred. */
  readonly isPartial: boolean;
}

export interface TimelineScale {
  readonly startIso: string;
  readonly dayCount: number;
  readonly dayWidth: number;
  readonly ticks: readonly TimelineTick[];
  readonly todayOffset: number | null;
}

/**
 * PRD rule: a start after its end is not an error state, it is swapped — the
 * caller warns, and `wasSwapped` is what it warns about.
 */
export function orderRange(
  startIso: string | null,
  endIso: string | null,
): { readonly start: string | null; readonly end: string | null; readonly wasSwapped: boolean } {
  if (!startIso || !endIso) return { start: startIso, end: endIso, wasSwapped: false };

  return dayIndex(startIso) > dayIndex(endIso)
    ? { start: endIso, end: startIso, wasSwapped: true }
    : { start: startIso, end: endIso, wasSwapped: false };
}

function readDate(rowId: string, rows: RowMap, column: BoardColumn | null): string | null {
  if (!column) return null;

  const row = rows[rowId];
  if (!row) return null;

  const value = cellOf(row, column);
  return value.kind === "date" ? value.iso : null;
}

/**
 * Bars for every row that has at least one of the two dates. A record with only
 * one end renders as a single day so it stays visible and draggable.
 */
export function buildBars(
  rowIds: readonly string[],
  rows: RowMap,
  startColumn: BoardColumn | null,
  endColumn: BoardColumn | null,
  rangeStartIso: string,
): readonly TimelineBar[] {
  const bars: TimelineBar[] = [];

  for (const rowId of rowIds) {
    const rawStart = readDate(rowId, rows, startColumn);
    const rawEnd = readDate(rowId, rows, endColumn);
    if (!rawStart && !rawEnd) continue;

    const ordered = orderRange(rawStart, rawEnd);
    const start = ordered.start ?? ordered.end;
    const end = ordered.end ?? ordered.start;
    if (!start || !end) continue;

    bars.push({
      rowId,
      startIso: startOfDay(start),
      endIso: startOfDay(end),
      offset: daysBetween(rangeStartIso, start),
      span: Math.max(MIN_BAR_DAYS, daysBetween(start, end) + 1),
      isInverted: ordered.wasSwapped,
      isPartial: !rawStart || !rawEnd,
    });
  }

  return bars;
}

/** The window the chart spans, padded around whatever the records occupy. */
export function timelineScale(
  rowIds: readonly string[],
  rows: RowMap,
  startColumn: BoardColumn | null,
  endColumn: BoardColumn | null,
  zoom: TimelineZoom,
  todayIso: string,
): TimelineScale {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const rowId of rowIds) {
    for (const iso of [readDate(rowId, rows, startColumn), readDate(rowId, rows, endColumn)]) {
      if (!iso) continue;
      const index = dayIndex(iso);
      min = Math.min(min, index);
      max = Math.max(max, index);
    }
  }

  const today = dayIndex(todayIso);
  if (!Number.isFinite(min)) {
    min = today;
    max = today + FALLBACK_SPAN_DAYS;
  }

  const startIso = startOfDay(isoFromDayIndex(min - PADDING_DAYS));
  const dayCount = max - min + 1 + PADDING_DAYS * 2;
  const todayOffset = today >= min - PADDING_DAYS && today <= max + PADDING_DAYS
    ? today - (min - PADDING_DAYS)
    : null;

  return {
    startIso,
    dayCount,
    dayWidth: DAY_WIDTH[zoom],
    ticks: buildTicks(startIso, dayCount, zoom),
    todayOffset,
  };
}

/**
 * Labels at the density the scale can carry: every day up close, every Monday
 * a step out, every month once a day is only a few pixels wide.
 */
function buildTicks(startIso: string, dayCount: number, zoom: TimelineZoom): readonly TimelineTick[] {
  const ticks: TimelineTick[] = [];
  const stride = TICK_STRIDE[zoom];

  for (let offset = 0; offset < dayCount; offset += 1) {
    const iso = addDays(startIso, offset);

    if (stride === "day") {
      ticks.push({ iso, offset, label: shortDayLabel(iso), isMajor: isFirstOfMonth(iso) });
      continue;
    }

    if (stride === "week") {
      if (weekdayIndex(iso) !== 0) continue;
      ticks.push({ iso, offset, label: shortDayLabel(iso), isMajor: isFirstOfMonth(iso) });
      continue;
    }

    if (!isFirstOfMonth(iso)) continue;
    ticks.push({ iso, offset, label: monthLabel(iso), isMajor: true });
  }

  // A window shorter than the stride can contain no boundary at all.
  if (ticks.length === 0) {
    ticks.push({ iso: startIso, offset: 0, label: monthLabel(startIso), isMajor: true });
  }

  return ticks;
}

export function offsetToIso(scale: TimelineScale, offset: number): string {
  return addDays(scale.startIso, Math.round(offset));
}

export { startOfWeek };
