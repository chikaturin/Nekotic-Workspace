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

export type TimelineZoom = GanttZoom;

export const TIMELINE_ZOOMS: readonly GanttZoom[] = ["week", "month", "quarter"];

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

export function normalizeGanttZoom(value: unknown): GanttZoom {
  return TIMELINE_ZOOMS.find((zoom) => zoom === value) ?? DEFAULT_GANTT_ZOOM;
}

const TICK_STRIDE: Readonly<Record<GanttZoom, "week" | "month">> = {
  week: "week",
  month: "month",
  quarter: "month",
};

const PADDING_DAYS = 3;
const FALLBACK_SPAN_DAYS = 30;
const MIN_BAR_DAYS = 1;

const MAX_RANGE_DAYS = 1100;

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
  readonly offset: number;
  readonly span: number;
  readonly isInverted: boolean;
  readonly isPartial: boolean;
}

export interface TimelineScale {
  readonly startIso: string;
  readonly dayCount: number;
  readonly dayWidth: number;
  readonly ticks: readonly TimelineTick[];
  readonly bands: readonly TimelineBand[];
  readonly todayOffset: number;
}

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

  min = Math.max(min, today - MAX_RANGE_DAYS);
  max = Math.min(max, today + MAX_RANGE_DAYS);

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

  if (ticks.length === 0) {
    ticks.push({ iso: startIso, offset: 0, label: monthLabel(startIso), isMajor: true });
  }

  return ticks;
}

export function offsetToIso(scale: TimelineScale, offset: number): string {
  return addDays(scale.startIso, Math.round(offset));
}

export { startOfWeek };
