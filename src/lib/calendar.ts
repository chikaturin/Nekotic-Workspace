/**
 * Calendar arithmetic for the date picker, done on day keys rather than
 * instants.
 *
 * A due date is a square on a calendar, not a moment. `27 Aug 2026` is the
 * same square in Hanoi and in London, and the classic bug — pick the 27th, save
 * it, reload it as the 26th — happens the instant that square is turned into a
 * timestamp in one zone and read back in another.
 *
 * So the unit here is a `DayKey`: the string `"2026-08-27"`. It has no zone to
 * get wrong, it sorts lexicographically, it compares with `===`, and it is
 * already what the board's filters and the subtask composer speak. Nothing in
 * this file constructs a local-time `Date` — every conversion goes through
 * `Date.UTC` and `toISOString`, which is the same anchor `formatDate` renders
 * in and `board-dates` measures in.
 */

import { MOCK_NOW } from "@/config/app";

/** `YYYY-MM-DD`. The unit of a date-only field. */
export type DayKey = string;

const KEY_PATTERN = /^(-?\d{4,6})-(\d{2})-(\d{2})$/;

const DAYS_IN_WEEK = 7;

/**
 * Always six, never five.
 *
 * A month needs four to six week rows, and sizing the grid to the month makes
 * the popover change height as you page through the year — the next-month
 * button moves out from under the pointer that is clicking it. A fixed grid
 * costs one row of muted numbers and buys a calendar that holds still.
 */
const WEEKS_IN_GRID = 6;

/**
 * Which day a week opens on: 0 is Sunday, 1 is Monday, 6 is Saturday.
 *
 * The product is Monday-first — `WEEKDAY_LABELS` and `weekdayIndex` in
 * `board-dates` both are, and the calendar board renders Monday-first grids —
 * so that is the default rather than the American Sunday. It stays a parameter
 * because the answer is regional, not architectural.
 */
export type WeekStart = 0 | 1 | 6;

export const DEFAULT_WEEK_START: WeekStart = 1;

/**
 * The locale every label in the picker is formatted through.
 *
 * `en-GB` because that is what `formatDate` already renders board dates in, and
 * a trigger reading `27 Aug 2026` above a calendar headed `August 2026` has to
 * agree with the cell behind it. Passed rather than imported at each call site
 * so switching it later is one prop, not a search.
 */
export const DEFAULT_DATE_LOCALE = "en-GB";

/* ------------------------------------------------------------ construction */

/**
 * A UTC date for a year/month/day, out-of-range values included.
 *
 * Two traps, and they interact. `Date.UTC(26, 7, 27)` is 1926 rather than the
 * year 26, so the year has to be applied with `setUTCFullYear` against a safe
 * base year. But that only works if the month and day cannot *themselves* move
 * the year: `Date.UTC(2000, 12, 1)` is 2001, and setting the year afterwards
 * throws that carry away — a month step off December would land back in the
 * same year it started in.
 *
 * So the month is folded into the year arithmetically first, leaving `Date.UTC`
 * a month it cannot overflow, and the day is applied afterwards from a real
 * anchor where rolling forward or back is exactly what we want.
 */
function utcOf(year: number, month: number, day: number): Date {
  const absolute = year * 12 + month;
  const wholeYears = Math.floor(absolute / 12);

  const at = new Date(Date.UTC(2000, absolute - wholeYears * 12, 1));
  at.setUTCFullYear(wholeYears);
  at.setUTCDate(day);
  return at;
}

/** Month is 0-based, and out-of-range month/day values roll over as expected. */
export function makeDayKey(year: number, month: number, day: number): DayKey {
  return utcOf(year, month, day).toISOString().slice(0, 10);
}

export interface DayParts {
  readonly year: number;
  /** 0-based, so it lines up with `Date`'s own month. */
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

  // `2026-02-31` parses as three numbers and is still not a date. Round-tripping
  // catches every such case without a table of month lengths.
  return makeDayKey(year, month, day) === key ? { year, month, day } : null;
}

export function isDayKey(value: string): boolean {
  return parseDayKey(value) !== null;
}

/* -------------------------------------------------------------- conversion */

/**
 * The day an instant falls on, in UTC.
 *
 * Deliberately UTC and not the reader's zone: the board stores `iso`, renders
 * it through `formatDate`'s `timeZone: "UTC"`, and buckets it in the calendar
 * view with `dayKey` — also UTC. A picker that read the local day would
 * disagree with all three for anybody east or west of London.
 */
export function dayKeyOf(iso: string | null | undefined): DayKey | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : new Date(at).toISOString().slice(0, 10);
}

/** Midnight UTC on that day — the instant a date-only value is stored as. */
export function isoOfDayKey(key: DayKey): string {
  return `${key}T00:00:00.000Z`;
}

/**
 * Move a stored instant onto a different day, keeping its time.
 *
 * A column with `includesTime` holds a meeting at 14:00; choosing a new day for
 * it should not silently reset that to midnight. The same rule the calendar
 * board applies when a card is dragged between days.
 */
export function withDayKey(iso: string | null, key: DayKey): string {
  if (!iso) return isoOfDayKey(key);

  const time = iso.slice(iso.indexOf("T"));
  return time.length > 1 ? `${key}${time}` : isoOfDayKey(key);
}

/**
 * Today, as a day key.
 *
 * Defaults to the frozen clock the rest of the app renders against, so server
 * and client markup match and a test never has to mock the calendar.
 */
export function todayKey(nowIso: string = MOCK_NOW): DayKey {
  return dayKeyOf(nowIso) ?? "";
}

/* -------------------------------------------------------------- arithmetic */

export function addDaysToKey(key: DayKey, days: number): DayKey {
  const parts = parseDayKey(key);
  return parts ? makeDayKey(parts.year, parts.month, parts.day + days) : key;
}

/**
 * Whole months, with the day of the month clamped rather than rolled over.
 *
 * `31 Jan` a month on is `28 Feb`, not `3 Mar`. Rolling over is what a bare
 * `month + 1` does, and it means paging forward from the end of a long month
 * skips February entirely.
 */
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

/** Day keys are fixed-width ISO, so string order is date order. */
export function compareDayKeys(a: DayKey, b: DayKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive on both ends; an absent bound is no bound. */
export function isWithinRange(
  key: DayKey,
  min: DayKey | null | undefined,
  max: DayKey | null | undefined,
): boolean {
  if (min && compareDayKeys(key, min) < 0) return false;
  if (max && compareDayKeys(key, max) > 0) return false;
  return true;
}

/**
 * Clamp a key into a range — what keeps the calendar from opening on a month
 * every day of which is out of bounds.
 */
export function clampDayKey(
  key: DayKey,
  min: DayKey | null | undefined,
  max: DayKey | null | undefined,
): DayKey {
  if (min && compareDayKeys(key, min) < 0) return min;
  if (max && compareDayKeys(key, max) > 0) return max;
  return key;
}

/** 0 for Sunday through 6 for Saturday, in UTC. */
export function weekdayOf(key: DayKey): number {
  const parts = parseDayKey(key);
  return parts ? utcOf(parts.year, parts.month, parts.day).getUTCDay() : 0;
}

/** The first day of the week `key` falls in, for the given week start. */
export function startOfWeekKey(key: DayKey, weekStart: WeekStart = DEFAULT_WEEK_START): DayKey {
  const offset = (weekdayOf(key) - weekStart + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  return addDaysToKey(key, -offset);
}

/* -------------------------------------------------------------------- grid */

export interface CalendarDay {
  readonly key: DayKey;
  readonly dayOfMonth: number;
  /** A leading or trailing day borrowed from the neighbouring month. */
  readonly isOutsideMonth: boolean;
}

/**
 * The six-by-seven grid a month is drawn on.
 *
 * Pure, and knows nothing about selection, today or which days are allowed —
 * those are the caller's, and keeping them out is what makes this testable
 * without a clock or a component.
 */
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

/* -------------------------------------------------------------- formatting */

/**
 * `Intl` instances are expensive to build and this makes seven of them per
 * calendar render otherwise — one per weekday heading, on every month change.
 */
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

/**
 * `27 Aug 2026` — the same shape `formatDate` gives a board cell, so the
 * trigger and the cell behind it read identically.
 */
export const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

/** `Thursday, 27 August 2026` — what a screen reader announces on a day. */
export const DAY_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

/** `August 2026` — the calendar's own heading. */
export function monthTitle(month: DayKey, locale: string = DEFAULT_DATE_LOCALE): string {
  return formatDayKey(month, { month: "long", year: "numeric" }, locale);
}

export interface WeekdayHeading {
  /** Two characters — `Mo`, `Tu` — which is what fits a compact grid. */
  readonly short: string;
  /** The whole word, for the column header's accessible name. */
  readonly long: string;
}

/**
 * The seven column headings, in the order this week start puts them.
 *
 * Derived from `Intl` against a known week rather than a hard-coded English
 * array, so a locale change moves the labels with the month name instead of
 * leaving `Mon Tue Wed` under `août 2026`. The short form is clipped from the
 * locale's own abbreviation because `weekday: "narrow"` gives `M T W T F S S`
 * in English — two pairs of which are indistinguishable.
 */
export function weekdayHeadings(
  weekStart: WeekStart = DEFAULT_WEEK_START,
  locale: string = DEFAULT_DATE_LOCALE,
): readonly WeekdayHeading[] {
  // 2026-01-04 is a Sunday, so adding the week start lands on the right day
  // whichever of the three starts was asked for.
  const sunday = "2026-01-04";

  return Array.from({ length: DAYS_IN_WEEK }, (_, offset) => {
    const key = addDaysToKey(sunday, weekStart + offset);

    return {
      short: formatDayKey(key, { weekday: "short" }, locale).slice(0, 2),
      long: formatDayKey(key, { weekday: "long" }, locale),
    };
  });
}
