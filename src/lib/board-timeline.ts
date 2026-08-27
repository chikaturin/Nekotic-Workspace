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
 * Three scales over the same unit.
 *
 * Zoom never changes the arithmetic — a day is always one unit — only how many
 * pixels that day is drawn as. Week reads a sprint, quarter reads a year, and
 * every offset in between stays a whole number of days.
 *
 * There is no per-day scale. At 44px a day the viewport held a fortnight, so
 * the scale that was meant to show detail was the one you had to scroll to
 * read anything at all — and every other surface that answers "what is
 * happening this week" (the calendar, My Work, the table sorted by date) does
 * it better. Week is the floor.
 */
export type TimelineZoom = GanttZoom;

export const TIMELINE_ZOOMS: readonly GanttZoom[] = ["week", "month", "quarter"];

/** What a view opens at, and what an unreadable stored value falls back to. */
export const DEFAULT_GANTT_ZOOM: GanttZoom = "week";

export const DAY_WIDTH: Readonly<Record<GanttZoom, number>> = {
  week: 18,
  month: 7,
  quarter: 3,
};

export const ZOOM_LABELS: Readonly<Record<GanttZoom, string>> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
};

/**
 * A saved view's stored zoom, made safe to use.
 *
 * Views written before the per-day scale was removed still carry `"day"`, and
 * a stored string is untrusted data either way. Rather than let an unknown
 * value reach `DAY_WIDTH` and render a chart whose days are `undefined` pixels
 * wide, anything the timeline does not recognise is read as Week — the nearest
 * surviving scale, and the one a Day view was closest to.
 */
export function normalizeGanttZoom(value: unknown): GanttZoom {
  return TIMELINE_ZOOMS.find((zoom) => zoom === value) ?? DEFAULT_GANTT_ZOOM;
}

/** Where a zoom stops labelling every day and starts labelling periods. */
const TICK_STRIDE: Readonly<Record<GanttZoom, "week" | "month">> = {
  week: "week",
  month: "month",
  quarter: "month",
};

/** Days of blank space kept on each side of the data. */
const PADDING_DAYS = 3;
const FALLBACK_SPAN_DAYS = 30;
const MIN_BAR_DAYS = 1;

/**
 * The widest window the chart will build.
 *
 * One record dated years out would otherwise stretch the timeline across a
 * decade of empty columns, which costs DOM and tells the reader nothing. The
 * window is clamped around today instead, and the outlier is simply off-screen.
 */
const MAX_RANGE_DAYS = 1100;

/**
 * The narrowest window each zoom will draw, in days.
 *
 * Zooming out is a request to see more time, not to see the same fortnight
 * drawn smaller. Without a floor, Quarter renders a board that happens to span
 * two months as a 180px stub against an empty canvas — accurate about the data
 * and useless to look at, because the scale is chosen for the horizon it
 * shows. Each figure is set so its column width fills a wide viewport:
 * 98 days at 18px, 380 at 7px, 760 at 3px.
 */
const MIN_SPAN_DAYS: Readonly<Record<TimelineZoom, number>> = {
  week: 98,
  month: 380,
  quarter: 760,
};

export interface TimelineTick {
  readonly iso: string;
  readonly offset: number;
  readonly label: string;
  readonly isMajor: boolean;
}

/**
 * The upper row of the header: the month (or year) a run of ticks belongs to.
 *
 * A scale that only labels "17 Aug, 24 Aug, 31 Aug" makes the reader carry the
 * month in their head. Naming the span above the columns is what turns a row of
 * dates into a calendar.
 */
export interface TimelineBand {
  readonly key: string;
  readonly offset: number;
  readonly days: number;
  readonly label: string;
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
  readonly bands: readonly TimelineBand[];
  /** Whole days from the range start; never null — today is always in range. */
  readonly todayOffset: number;
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
 * one end renders as a single day so it stays visible rather than collapsing to
 * nothing.
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

/**
 * The window the chart spans.
 *
 * Today is always inside it. A chart that opens on a range the reader is not
 * living in — because every record happens to sit last quarter — makes them
 * hunt for the present before they can read anything, so the present is part
 * of the range by construction rather than by luck.
 */
export function timelineScale(
  rowIds: readonly string[],
  rows: RowMap,
  startColumn: BoardColumn | null,
  endColumn: BoardColumn | null,
  zoom: TimelineZoom,
  todayIso: string,
): TimelineScale {
  const today = dayIndex(todayIso);

  let min = today;
  let max = today;

  for (const rowId of rowIds) {
    for (const iso of [readDate(rowId, rows, startColumn), readDate(rowId, rows, endColumn)]) {
      if (!iso) continue;
      const index = dayIndex(iso);
      min = Math.min(min, index);
      max = Math.max(max, index);
    }
  }

  if (min === max) max = today + FALLBACK_SPAN_DAYS;

  // Clamp around today rather than around the data, so an outlier trims the
  // far end instead of pushing the present off the chart.
  min = Math.max(min, today - MAX_RANGE_DAYS);
  max = Math.min(max, today + MAX_RANGE_DAYS);

  // Then widen to the zoom's own horizon, evenly on both sides so the data
  // stays centred. Every floor is well inside the clamp above, so this can
  // never reintroduce the outlier problem it sits below.
  const shortfall = MIN_SPAN_DAYS[zoom] - (max - min + 1);
  if (shortfall > 0) {
    min -= Math.floor(shortfall / 2);
    max += Math.ceil(shortfall / 2);
  }

  const from = min - PADDING_DAYS;
  const startIso = startOfDay(isoFromDayIndex(from));
  const dayCount = max - min + 1 + PADDING_DAYS * 2;

  return {
    startIso,
    dayCount,
    dayWidth: DAY_WIDTH[zoom],
    ticks: buildTicks(startIso, dayCount, zoom),
    bands: buildBands(startIso, dayCount, zoom),
    todayOffset: today - from,
  };
}

/**
 * The header's upper row: one entry per month, or per year once a month is too
 * narrow to hold its own name.
 */
function buildBands(
  startIso: string,
  dayCount: number,
  zoom: TimelineZoom,
): readonly TimelineBand[] {
  const bands: TimelineBand[] = [];
  const byYear = zoom === "quarter";

  for (let offset = 0; offset < dayCount; offset += 1) {
    const iso = addDays(startIso, offset);
    const key = byYear ? iso.slice(0, 4) : iso.slice(0, 7);
    const last = bands[bands.length - 1];

    if (last && last.key === key) {
      bands[bands.length - 1] = { ...last, days: last.days + 1 };
      continue;
    }

    bands.push({
      key,
      offset,
      days: 1,
      label: byYear ? iso.slice(0, 4) : monthLabel(iso),
    });
  }

  return bands;
}

/**
 * Labels at the density the scale can carry: every Monday up close, every
 * month once a day is only a few pixels wide.
 */
function buildTicks(startIso: string, dayCount: number, zoom: TimelineZoom): readonly TimelineTick[] {
  const ticks: TimelineTick[] = [];
  const stride = TICK_STRIDE[zoom];

  for (let offset = 0; offset < dayCount; offset += 1) {
    const iso = addDays(startIso, offset);

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
