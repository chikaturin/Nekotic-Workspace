import { afterEach, describe, expect, test } from "vitest";
import {
  addDaysToKey,
  addMonthsToKey,
  buildCalendarWeeks,
  clampDayKey,
  compareDayKeys,
  DAY_FORMAT,
  DAY_LABEL_FORMAT,
  DEFAULT_WEEK_START,
  dayKeyOf,
  daysInMonth,
  formatDayKey,
  isDayKey,
  isSameMonth,
  isWithinRange,
  isoOfDayKey,
  makeDayKey,
  monthTitle,
  parseDayKey,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
  weekdayHeadings,
  weekdayOf,
  withDayKey,
  type DayKey,
} from "@/lib/calendar";
import { MOCK_NOW } from "@/config/app";
import { formatDate } from "@/lib/format";

/**
 * The date picker, tested where it can actually be wrong.
 *
 * The component is a month of buttons; what breaks a date field is never the
 * buttons. It is the arithmetic underneath — a month rolled over instead of
 * clamped, a week started on the wrong day, and above all a day that survived
 * being written and came back as the day before. So this file is the day-key
 * layer, tested including under the two timezones furthest from UTC.
 */

/* ------------------------------------------------------------- the day key */

describe("a day is a key, not an instant", () => {
  test("a well-formed key parses to its three numbers, zero-based month", () => {
    expect(parseDayKey("2026-08-27")).toEqual({ year: 2026, month: 7, day: 27 });
    expect(parseDayKey("2026-01-01")).toEqual({ year: 2026, month: 0, day: 1 });
    expect(parseDayKey("2024-02-29")).toEqual({ year: 2024, month: 1, day: 29 });
  });

  /** Three numbers in the right shape are not automatically a date. */
  test("a date that does not exist is refused rather than rolled over", () => {
    expect(parseDayKey("2026-02-30")).toBeNull();
    expect(parseDayKey("2023-02-29")).toBeNull();
    expect(parseDayKey("2026-04-31")).toBeNull();
    expect(parseDayKey("2026-13-01")).toBeNull();
    expect(parseDayKey("2026-00-10")).toBeNull();
  });

  test("anything that is not the shape is refused", () => {
    for (const bad of ["", "2026-8-27", "27/08/2026", "2026-08-27T00:00:00Z", "today"]) {
      expect(isDayKey(bad)).toBe(false);
    }
    expect(isDayKey("2026-08-27")).toBe(true);
  });

  /**
   * `Date.UTC(26, 7, 27)` is 1926. The two-digit-year rule is the kind of thing
   * that only shows up once somebody's `minDate` arithmetic walks back far
   * enough to reach it.
   */
  test("a two-digit year means that year, not nineteen-hundred-and-it", () => {
    expect(makeDayKey(26, 7, 27)).toBe("0026-08-27");
    expect(makeDayKey(99, 0, 1)).toBe("0099-01-01");
  });

  test("out-of-range month and day roll over, which is what makes the arithmetic work", () => {
    expect(makeDayKey(2026, 12, 1)).toBe("2027-01-01");
    expect(makeDayKey(2026, -1, 1)).toBe("2025-12-01");
    expect(makeDayKey(2026, 0, 32)).toBe("2026-02-01");
    expect(makeDayKey(2026, 7, 0)).toBe("2026-07-31");
  });

  test("keys sort as dates, because they are fixed-width", () => {
    expect(compareDayKeys("2026-08-27", "2026-09-01")).toBe(-1);
    expect(compareDayKeys("2026-09-01", "2026-08-27")).toBe(1);
    expect(compareDayKeys("2026-08-27", "2026-08-27")).toBe(0);
    expect(["2026-12-01", "2026-02-10", "2026-08-27"].toSorted(compareDayKeys)).toEqual([
      "2026-02-10",
      "2026-08-27",
      "2026-12-01",
    ]);
  });
});

/* ------------------------------------------------------------- arithmetic */

describe("moving around the calendar", () => {
  test("days cross month and year ends", () => {
    expect(addDaysToKey("2026-08-27", 1)).toBe("2026-08-28");
    expect(addDaysToKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysToKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToKey("2026-08-27", 7)).toBe("2026-09-03");
  });

  test("leap days exist in the years that have them", () => {
    expect(addDaysToKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysToKey("2023-02-28", 1)).toBe("2023-03-01");
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(daysInMonth(2100, 1)).toBe(28);
    expect(daysInMonth(2000, 1)).toBe(29);
  });

  /**
   * The bug a bare `month + 1` gives you: paging forward from the 31st lands
   * two months on, so February is unreachable from the end of January.
   */
  test("a month step clamps the day instead of rolling past the short month", () => {
    expect(addMonthsToKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToKey("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsToKey("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsToKey("2026-08-27", 1)).toBe("2026-09-27");
  });

  test("month steps cross years in both directions", () => {
    expect(addMonthsToKey("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsToKey("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonthsToKey("2026-08-27", 12)).toBe("2027-08-27");
    expect(addMonthsToKey("2026-08-27", -20)).toBe("2024-12-27");
  });

  test("a bad key is returned untouched rather than becoming NaN", () => {
    expect(addDaysToKey("nonsense", 3)).toBe("nonsense");
    expect(addMonthsToKey("nonsense", 3)).toBe("nonsense");
    expect(startOfMonthKey("nonsense")).toBe("nonsense");
  });

  test("the month a key belongs to", () => {
    expect(startOfMonthKey("2026-08-27")).toBe("2026-08-01");
    expect(isSameMonth("2026-08-01", "2026-08-31")).toBe(true);
    expect(isSameMonth("2026-08-31", "2026-09-01")).toBe(false);
  });
});

/* ------------------------------------------------------------- week starts */

describe("a week starts where the region says it does", () => {
  /** 27 Aug 2026 is a Thursday. */
  test("weekday is UTC, counted from Sunday", () => {
    expect(weekdayOf("2026-08-27")).toBe(4);
    expect(weekdayOf("2026-08-30")).toBe(0);
    expect(weekdayOf("2026-08-29")).toBe(6);
  });

  test("the product's Monday start matches the board calendar and the timeline", () => {
    expect(DEFAULT_WEEK_START).toBe(1);
    expect(startOfWeekKey("2026-08-27")).toBe("2026-08-24");
    // Sunday belongs to the week that has already started, not the next one.
    expect(startOfWeekKey("2026-08-30")).toBe("2026-08-24");
  });

  test("Sunday and Saturday starts are the same arithmetic with a different offset", () => {
    expect(startOfWeekKey("2026-08-27", 0)).toBe("2026-08-23");
    expect(startOfWeekKey("2026-08-27", 6)).toBe("2026-08-22");
  });

  test("headings follow the week start rather than a hard-coded array", () => {
    expect(weekdayHeadings(1).map((day) => day.short)).toEqual([
      "Mo",
      "Tu",
      "We",
      "Th",
      "Fr",
      "Sa",
      "Su",
    ]);
    expect(weekdayHeadings(0).map((day) => day.short)).toEqual([
      "Su",
      "Mo",
      "Tu",
      "We",
      "Th",
      "Fr",
      "Sa",
    ]);
    expect(weekdayHeadings(6)[0]).toEqual({ short: "Sa", long: "Saturday" });
  });

  test("headings follow the locale too, so a month name and its columns agree", () => {
    expect(weekdayHeadings(1, "fr-FR")[0]?.long).toBe("lundi");
    expect(monthTitle("2026-08-01", "fr-FR")).toBe("août 2026");
  });
});

/* ------------------------------------------------------------------- grid */

describe("the month grid", () => {
  test("is always six weeks, so the popover never changes height", () => {
    for (const month of ["2026-02-01", "2026-08-01", "2026-11-01", "2027-05-01"]) {
      const weeks = buildCalendarWeeks(month);
      expect(weeks).toHaveLength(6);
      expect(weeks.every((week) => week.length === 7)).toBe(true);
    }
  });

  /** August 2026 opens on a Saturday, so a Monday grid borrows six July days. */
  test("opens on the week start and borrows the days before the first", () => {
    const weeks = buildCalendarWeeks("2026-08-01", 1);
    expect(weeks[0]?.map((day) => day.key)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  test("borrowed days are marked as outside, and the month's own are not", () => {
    const days = buildCalendarWeeks("2026-08-01", 1).flat();
    const august = days.filter((day) => !day.isOutsideMonth);

    expect(august).toHaveLength(31);
    expect(august[0]?.key).toBe("2026-08-01");
    expect(august.at(-1)?.key).toBe("2026-08-31");
    expect(days[0]?.isOutsideMonth).toBe(true);
  });

  test("every day is one after the one before it, with no gaps or repeats", () => {
    const keys = buildCalendarWeeks("2026-02-01").flat().map((day) => day.key);

    expect(new Set(keys).size).toBe(42);
    for (let index = 1; index < keys.length; index += 1) {
      expect(keys[index]).toBe(addDaysToKey(keys[index - 1] ?? "", 1));
    }
  });

  test("the number on the square is the day of its own month", () => {
    const first = buildCalendarWeeks("2026-08-01", 1)[0];
    expect(first?.map((day) => day.dayOfMonth)).toEqual([27, 28, 29, 30, 31, 1, 2]);
  });

  test("any day of a month builds that month, not a grid starting on that day", () => {
    expect(buildCalendarWeeks("2026-08-27")).toEqual(buildCalendarWeeks("2026-08-01"));
  });

  test("February in a leap year still fits, with no day lost", () => {
    const february = buildCalendarWeeks("2024-02-01")
      .flat()
      .filter((day) => !day.isOutsideMonth);
    expect(february).toHaveLength(29);
    expect(february.at(-1)?.key).toBe("2024-02-29");
  });
});

/* --------------------------------------------------------- the roving cursor */

/**
 * The calendar's one tab stop, modelled.
 *
 * A `role="grid"` is entered with a single Tab and navigated with the arrows,
 * which means exactly one day carries `tabIndex={0}`. If that day is not one
 * the grid is currently drawing, the whole calendar drops out of the tab order
 * — Tab goes straight past it and the keyboard can never reach a date. This is
 * the derivation that guarantees it, and the month buttons run through the
 * same arithmetic so paging cannot strand it either.
 */
function cursorFor(month: DayKey, focused: DayKey | null, value: DayKey | null, today: DayKey) {
  const preferred = focused ?? value ?? today;
  return isSameMonth(preferred, month) ? preferred : month;
}

describe("the calendar always has exactly one tab stop, and it is on screen", () => {
  const isDrawn = (month: DayKey, day: DayKey) =>
    buildCalendarWeeks(month)
      .flat()
      .some((cell) => cell.key === day);

  test("the selection when it is this month, today when it is, the first otherwise", () => {
    expect(cursorFor("2026-08-01", null, "2026-08-27", "2026-08-26")).toBe("2026-08-27");
    expect(cursorFor("2026-08-01", null, null, "2026-08-26")).toBe("2026-08-26");
    expect(cursorFor("2026-08-01", null, "2026-12-15", "2027-01-04")).toBe("2026-08-01");
    expect(cursorFor("2026-08-01", "2026-08-19", "2026-08-27", "2026-08-26")).toBe("2026-08-19");
  });

  /** Paging away from a value in another month is where it used to be stranded. */
  test("whatever the month and wherever the value is, the stop is drawn", () => {
    const months = ["2026-01-01", "2026-02-01", "2026-08-01", "2026-09-01", "2027-02-01"];
    const days = [null, "2026-08-27", "2025-11-30", "2027-06-15"] as const;

    for (const month of months) {
      for (const focused of days) {
        for (const value of days) {
          const cursor = cursorFor(month, focused, value, "2026-08-26");
          expect(isDrawn(month, cursor)).toBe(true);
        }
      }
    }
  });

  test("a month button keeps the day of the month, clamping where it does not exist", () => {
    expect(addMonthsToKey("2026-08-31", 1)).toBe("2026-09-30");
    expect(addMonthsToKey("2026-08-31", -1)).toBe("2026-07-31");
    // And whatever it lands on is drawn by the month it lands in.
    for (const delta of [-13, -1, 1, 5, 12]) {
      const landed = addMonthsToKey("2026-08-31", delta);
      expect(isDrawn(startOfMonthKey(landed), landed)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ bounds */

describe("bounds and business rules", () => {
  test("a range is inclusive at both ends", () => {
    expect(isWithinRange("2026-08-27", "2026-08-27", "2026-09-11")).toBe(true);
    expect(isWithinRange("2026-09-11", "2026-08-27", "2026-09-11")).toBe(true);
    expect(isWithinRange("2026-08-26", "2026-08-27", "2026-09-11")).toBe(false);
    expect(isWithinRange("2026-09-12", "2026-08-27", "2026-09-11")).toBe(false);
  });

  test("an absent bound is no bound at all", () => {
    expect(isWithinRange("1999-01-01", null, "2026-09-11")).toBe(true);
    expect(isWithinRange("2999-01-01", "2026-08-27", null)).toBe(true);
    expect(isWithinRange("2026-08-27", null, null)).toBe(true);
  });

  /** What stops a picker opening on a month with no selectable day in it. */
  test("clamping pulls a day back inside the window", () => {
    expect(clampDayKey("2020-01-01", "2026-08-27", "2026-09-11")).toBe("2026-08-27");
    expect(clampDayKey("2030-01-01", "2026-08-27", "2026-09-11")).toBe("2026-09-11");
    expect(clampDayKey("2026-09-01", "2026-08-27", "2026-09-11")).toBe("2026-09-01");
    expect(clampDayKey("2026-09-01", null, null)).toBe("2026-09-01");
  });
});

/* -------------------------------------------------------------- timezones */

describe("the day you clicked is the day that is stored", () => {
  const original = process.env.TZ;

  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  /**
   * The bug this component exists to not have: pick 27 Aug, save, reload, get
   * 26 Aug. It happens when a day is turned into an instant in one zone and
   * read back in another, and the two zones furthest from UTC are where it
   * shows first — Kiritimati is +14, Midway is −11, so between them they cover
   * a 25-hour spread that any local-time arithmetic falls through.
   */
  const EXTREMES = ["Pacific/Kiritimati", "Pacific/Midway", "Asia/Ho_Chi_Minh", "UTC"] as const;

  test("a day survives the round trip through storage in every timezone", () => {
    for (const zone of EXTREMES) {
      process.env.TZ = zone;

      for (const day of ["2026-08-27", "2026-01-01", "2026-12-31", "2024-02-29"]) {
        expect(dayKeyOf(isoOfDayKey(day))).toBe(day);
      }
    }
  });

  test("the arithmetic and the grid do not move with the clock", () => {
    const inZone = (zone: string) => {
      process.env.TZ = zone;
      return {
        added: addDaysToKey("2026-08-31", 1),
        month: addMonthsToKey("2026-01-31", 1),
        week: startOfWeekKey("2026-08-30"),
        grid: buildCalendarWeeks("2026-08-01").flat().map((day) => day.key),
        label: formatDayKey("2026-08-27", DAY_FORMAT),
      };
    };

    const east = inZone("Pacific/Kiritimati");
    const west = inZone("Pacific/Midway");

    expect(east).toEqual(west);
    expect(east.added).toBe("2026-09-01");
    expect(east.label).toBe("27 Aug 2026");
  });

  test("what the picker writes is what the board renders", () => {
    for (const zone of EXTREMES) {
      process.env.TZ = zone;
      // `formatDate` is the board's own cell renderer, pinned to UTC. A picker
      // that disagreed with it would show one date on the trigger and another
      // in the cell it had just written.
      expect(formatDate(isoOfDayKey("2026-08-27"))).toBe("27 Aug 2026");
      expect(formatDayKey("2026-08-27", DAY_FORMAT)).toBe("27 Aug 2026");
    }
  });
});

/* ------------------------------------------------------------- conversion */

describe("talking to a board that stores instants", () => {
  test("an instant becomes the day it falls on, in UTC", () => {
    expect(dayKeyOf("2026-08-27T00:00:00.000Z")).toBe("2026-08-27");
    expect(dayKeyOf("2026-08-27T23:59:59.999Z")).toBe("2026-08-27");
    expect(dayKeyOf(MOCK_NOW)).toBe("2026-08-26");
  });

  test("nothing in, nothing out", () => {
    expect(dayKeyOf(null)).toBeNull();
    expect(dayKeyOf(undefined)).toBeNull();
    expect(dayKeyOf("")).toBeNull();
    expect(dayKeyOf("not a date")).toBeNull();
  });

  test("a day becomes midnight UTC", () => {
    expect(isoOfDayKey("2026-08-27")).toBe("2026-08-27T00:00:00.000Z");
  });

  /**
   * A column that carries a time holds a meeting at 14:00. Moving it a day
   * must not quietly reset that to midnight — the same rule the calendar board
   * applies when a card is dragged between days.
   */
  test("moving a value to another day keeps its time of day", () => {
    expect(withDayKey("2026-08-27T14:30:00.000Z", "2026-09-01")).toBe(
      "2026-09-01T14:30:00.000Z",
    );
    expect(withDayKey(null, "2026-09-01")).toBe("2026-09-01T00:00:00.000Z");
    expect(withDayKey("2026-08-27", "2026-09-01")).toBe("2026-09-01T00:00:00.000Z");
  });

  test("today comes from the app's frozen clock, so markup matches on both sides", () => {
    expect(todayKey()).toBe("2026-08-26");
    expect(todayKey("2026-12-25T18:00:00.000Z")).toBe("2026-12-25");
  });
});

/* ------------------------------------------------------------- formatting */

describe("labels", () => {
  test("the trigger reads the way the rest of the app writes dates", () => {
    expect(formatDayKey("2026-08-27", DAY_FORMAT)).toBe("27 Aug 2026");
    expect(formatDayKey("2026-01-05", DAY_FORMAT)).toBe("05 Jan 2026");
  });

  /** A grid you navigate a square at a time cannot announce bare numbers. */
  test("a day announces its weekday, month and year", () => {
    expect(formatDayKey("2026-08-27", DAY_LABEL_FORMAT)).toBe("Thursday, 27 August 2026");
  });

  test("the heading names the month and the year", () => {
    expect(monthTitle("2026-08-01")).toBe("August 2026");
    expect(monthTitle("2027-01-15")).toBe("January 2027");
  });

  test("a key that is not a date is shown rather than swallowed", () => {
    expect(formatDayKey("nonsense", DAY_FORMAT)).toBe("nonsense");
  });
});

/* ------------------------------------------------- what the screens do with it */

describe("the surfaces that consume it", () => {
  /**
   * Filters and rules already stored `YYYY-MM-DD` — it is what the native
   * input produced — so the picker drops straight in and the bound the rule
   * compares against is the day that was clicked.
   */
  test("a filter bound is a day key on both sides of the picker", () => {
    const chosen: DayKey = "2026-08-27";
    expect(isDayKey(chosen)).toBe(true);
    expect(Date.parse(chosen)).toBe(Date.parse("2026-08-27T00:00:00.000Z"));
  });

  test("an empty field and a cleared field are the same thing", () => {
    const toFilterValue = (day: DayKey | null) => day ?? "";
    const fromFilterValue = (value: string) => (value === "" ? null : value);

    expect(toFilterValue(null)).toBe("");
    expect(fromFilterValue("")).toBeNull();
    expect(fromFilterValue(toFilterValue("2026-08-27"))).toBe("2026-08-27");
  });

  /**
   * The date cell's own conversion, both ways. A date-only column keeps the
   * time it happened to carry; the cell only ever shows the day.
   */
  test("a date cell round-trips through the picker without moving", () => {
    const stored = "2026-08-27T09:15:00.000Z";
    const shown = dayKeyOf(stored);
    expect(shown).toBe("2026-08-27");
    expect(withDayKey(stored, shown ?? "")).toBe(stored);
  });
});
