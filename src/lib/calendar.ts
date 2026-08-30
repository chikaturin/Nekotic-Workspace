
import { MOCK_NOW } from "@/config/app";

export type DayKey = string;

const KEY_PATTERN = /^(-?\d{4,6})-(\d{2})-(\d{2})$/;

const DAYS_IN_WEEK = 7;

const WEEKS_IN_GRID = 6;

export type WeekStart = 0 | 1 | 6;

export const DEFAULT_WEEK_START: WeekStart = 1;

export const DEFAULT_DATE_LOCALE = "en-GB";

function utcOf(year: number, month: number, day: number): Date {
  const absolute = year * 12 + month;
  const wholeYears = Math.floor(absolute / 12);

  const at = new Date(Date.UTC(2000, absolute - wholeYears * 12, 1));
  at.setUTCFullYear(wholeYears);
  at.setUTCDate(day);
  return at;
}

export function makeDayKey(year: number, month: number, day: number): DayKey {
  return utcOf(year, month, day).toISOString().slice(0, 10);
}

export interface DayParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function parseDayKey(key: DayKey): DayParts | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || month < 0 || month > 11 || day < 1 || day > 31) return null;

  return makeDayKey(year, month, day) === key ? { year, month, day } : null;
}

export function isDayKey(value: string): boolean {
  return parseDayKey(value) !== null;
}

export function dayKeyOf(iso: string | null | undefined): DayKey | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : new Date(at).toISOString().slice(0, 10);
}

export function isoOfDayKey(key: DayKey): string {
  return `${key}T00:00:00.000Z`;
}

export function withDayKey(iso: string | null, key: DayKey): string {
  if (!iso) return isoOfDayKey(key);

  const time = iso.slice(iso.indexOf("T"));
  return time.length > 1 ? `${key}${time}` : isoOfDayKey(key);
}

export function todayKey(nowIso: string = MOCK_NOW): DayKey {
  return dayKeyOf(nowIso) ?? "";
}

export function addDaysToKey(key: DayKey, days: number): DayKey {
  const parts = parseDayKey(key);
  return parts ? makeDayKey(parts.year, parts.month, parts.day + days) : key;
}

export function addMonthsToKey(key: DayKey, months: number): DayKey {
  const parts = parseDayKey(key);
  if (!parts) return key;

  const absolute = parts.year * 12 + parts.month + months;
  const year = Math.floor(absolute / 12);
  const month = absolute - year * 12;

  return makeDayKey(year, month, Math.min(parts.day, daysInMonth(year, month)));
}

export function daysInMonth(year: number, month: number): number {
  return utcOf(year, month + 1, 0).getUTCDate();
}

export function startOfMonthKey(key: DayKey): DayKey {
  const parts = parseDayKey(key);
  return parts ? makeDayKey(parts.year, parts.month, 1) : key;
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function compareDayKeys(a: DayKey, b: DayKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isWithinRange(
  key: DayKey,
  min: DayKey | null | undefined,
  max: DayKey | null | undefined,
): boolean {
  if (min && compareDayKeys(key, min) < 0) return false;
  if (max && compareDayKeys(key, max) > 0) return false;
  return true;
}

export function clampDayKey(
  key: DayKey,
  min: DayKey | null | undefined,
  max: DayKey | null | undefined,
): DayKey {
  if (min && compareDayKeys(key, min) < 0) return min;
  if (max && compareDayKeys(key, max) > 0) return max;
  return key;
}

export function weekdayOf(key: DayKey): number {
  const parts = parseDayKey(key);
  return parts ? utcOf(parts.year, parts.month, parts.day).getUTCDay() : 0;
}

export function startOfWeekKey(key: DayKey, weekStart: WeekStart = DEFAULT_WEEK_START): DayKey {
  const offset = (weekdayOf(key) - weekStart + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  return addDaysToKey(key, -offset);
}

export interface CalendarDay {
  readonly key: DayKey;
  readonly dayOfMonth: number;
  readonly isOutsideMonth: boolean;
}

export function buildCalendarWeeks(
  month: DayKey,
  weekStart: WeekStart = DEFAULT_WEEK_START,
): readonly (readonly CalendarDay[])[] {
  const first = startOfMonthKey(month);
  const gridStart = startOfWeekKey(first, weekStart);
  const monthPrefix = first.slice(0, 7);

  return Array.from({ length: WEEKS_IN_GRID }, (_, week) =>
    Array.from({ length: DAYS_IN_WEEK }, (_, offset) => {
      const key = addDaysToKey(gridStart, week * DAYS_IN_WEEK + offset);

      return {
        key,
        dayOfMonth: Number(key.slice(8, 10)),
        isOutsideMonth: key.slice(0, 7) !== monthPrefix,
      };
    }),
  );
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${JSON.stringify(options)}`;
  const cached = formatters.get(cacheKey);
  if (cached) return cached;

  const built = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  formatters.set(cacheKey, built);
  return built;
}

function dateOf(key: DayKey): Date | null {
  const parts = parseDayKey(key);
  return parts ? utcOf(parts.year, parts.month, parts.day) : null;
}

export function formatDayKey(
  key: DayKey,
  options: Intl.DateTimeFormatOptions,
  locale: string = DEFAULT_DATE_LOCALE,
): string {
  const date = dateOf(key);
  return date ? formatter(locale, options).format(date) : key;
}

export const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

export const DAY_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

export function monthTitle(month: DayKey, locale: string = DEFAULT_DATE_LOCALE): string {
  return formatDayKey(month, { month: "long", year: "numeric" }, locale);
}

export interface WeekdayHeading {
  readonly short: string;
  readonly long: string;
}

export function weekdayHeadings(
  weekStart: WeekStart = DEFAULT_WEEK_START,
  locale: string = DEFAULT_DATE_LOCALE,
): readonly WeekdayHeading[] {
  const sunday = "2026-01-04";

  return Array.from({ length: DAYS_IN_WEEK }, (_, offset) => {
    const key = addDaysToKey(sunday, weekStart + offset);

    return {
      short: formatDayKey(key, { weekday: "short" }, locale).slice(0, 2),
      long: formatDayKey(key, { weekday: "long" }, locale),
    };
  });
}
