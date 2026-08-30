import {
  addDays,
  addMonths,
  dayKey,
  isSameDay,
  monthLabel,
  startOfMonth,
  startOfWeek,
} from "@/lib/board-dates";
import { cellOf } from "@/lib/cell-values";
import type { RowMap } from "@/lib/board-records";
import type { BoardColumn } from "@/types";

const WEEKS_IN_GRID = 6;
const DAYS_IN_WEEK = 7;

export interface CalendarDay {
  readonly iso: string;
  readonly key: string;
  readonly dayOfMonth: number;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly rowIds: readonly string[];
}

export interface CalendarMonth {
  readonly monthIso: string;
  readonly label: string;
  readonly weeks: readonly (readonly CalendarDay[])[];
  readonly unscheduled: readonly string[];
  readonly scheduledCount: number;
}

export function bucketByDay(
  rowIds: readonly string[],
  rows: RowMap,
  column: BoardColumn,
): { readonly byDay: ReadonlyMap<string, readonly string[]>; readonly unscheduled: readonly string[] } {
  const byDay = new Map<string, string[]>();
  const unscheduled: string[] = [];

  for (const rowId of rowIds) {
    const row = rows[rowId];
    if (!row) continue;

    const value = cellOf(row, column);
    const key = value.kind === "date" ? dayKey(value.iso) : null;

    if (!key) {
      unscheduled.push(rowId);
      continue;
    }

    const bucket = byDay.get(key);
    if (bucket) bucket.push(rowId);
    else byDay.set(key, [rowId]);
  }

  return { byDay, unscheduled };
}

export function buildMonth(
  monthIso: string,
  rowIds: readonly string[],
  rows: RowMap,
  column: BoardColumn,
  todayIso: string,
): CalendarMonth {
  const { byDay, unscheduled } = bucketByDay(rowIds, rows, column);
  const first = startOfMonth(monthIso);
  const gridStart = startOfWeek(first);
  const monthNumber = new Date(first).getUTCMonth();

  let scheduledCount = 0;
  const weeks: CalendarDay[][] = [];

  for (let week = 0; week < WEEKS_IN_GRID; week += 1) {
    const days: CalendarDay[] = [];

    for (let offset = 0; offset < DAYS_IN_WEEK; offset += 1) {
      const iso = addDays(gridStart, week * DAYS_IN_WEEK + offset);
      const key = dayKey(iso) ?? "";
      const dayRows = byDay.get(key) ?? [];
      scheduledCount += dayRows.length;

      days.push({
        iso,
        key,
        dayOfMonth: new Date(iso).getUTCDate(),
        isCurrentMonth: new Date(iso).getUTCMonth() === monthNumber,
        isToday: isSameDay(iso, todayIso),
        rowIds: dayRows,
      });
    }

    weeks.push(days);
  }

  return {
    monthIso: first,
    label: monthLabel(first),
    weeks,
    unscheduled,
    scheduledCount,
  };
}

export function shiftMonth(monthIso: string, delta: number): string {
  return addMonths(monthIso, delta);
}

export function moveToDay(currentIso: string | null, dayIso: string): string {
  if (!currentIso) return dayIso;

  const time = currentIso.slice(11);
  const day = dayKey(dayIso);
  return day ? `${day}T${time || "00:00:00.000Z"}` : dayIso;
}
