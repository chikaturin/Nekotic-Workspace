/** UTC day arithmetic shared by the calendar and the timeline. */

export const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for an instant, or null when there is no date. */
export function dayKey(iso: string | null): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : new Date(at).toISOString().slice(0, 10);
}

/** Midnight UTC of the day an instant falls in. */
export function startOfDay(iso: string): string {
  const key = dayKey(iso);
  return key ? `${key}T00:00:00.000Z` : iso;
}

export function dayIndex(iso: string): number {
  return Math.floor(Date.parse(startOfDay(iso)) / DAY_MS);
}

export function isoFromDayIndex(index: number): string {
  return new Date(index * DAY_MS).toISOString();
}

export function addDays(iso: string, days: number): string {
  return isoFromDayIndex(dayIndex(iso) + days);
}

export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

export function isSameDay(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && dayKey(a) === dayKey(b);
}

/** Monday-first weekday index: Monday is 0, Sunday is 6. */
export function weekdayIndex(iso: string): number {
  return (new Date(startOfDay(iso)).getUTCDay() + 6) % 7;
}

/** Saturday or Sunday, in UTC — what the chart shades. */
export function isWeekend(iso: string): boolean {
  return weekdayIndex(iso) >= 5;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function startOfMonth(iso: string): string {
  const date = new Date(startOfDay(iso));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

export function addMonths(iso: string, months: number): string {
  const date = new Date(startOfDay(iso));
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  ).toISOString();
}

export function isFirstOfMonth(iso: string): boolean {
  return new Date(startOfDay(iso)).getUTCDate() === 1;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function monthLabel(iso: string): string {
  const date = new Date(startOfDay(iso));
  return `${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
}

export function shortDayLabel(iso: string): string {
  const date = new Date(startOfDay(iso));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""}`;
}

/** `26 Aug 2026` — the unambiguous form a tooltip should carry. */
export function longDayLabel(iso: string): string {
  const date = new Date(startOfDay(iso));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
}

export function dayOfMonth(iso: string): number {
  return new Date(startOfDay(iso)).getUTCDate();
}
