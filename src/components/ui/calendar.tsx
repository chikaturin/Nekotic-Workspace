"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  addDaysToKey,
  addMonthsToKey,
  buildCalendarWeeks,
  clampDayKey,
  compareDayKeys,
  DAY_LABEL_FORMAT,
  DEFAULT_DATE_LOCALE,
  DEFAULT_WEEK_START,
  formatDayKey,
  isSameMonth,
  isWithinRange,
  monthTitle,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
  weekdayHeadings,
  type DayKey,
  type WeekStart,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

export interface CalendarProps {
  /** The chosen day, or null. A day key — `2026-08-27`. */
  readonly value?: DayKey | null;
  readonly onSelect: (day: DayKey) => void;
  /** Rendered with its own mark even when it is not the selection. */
  readonly today?: DayKey;
  readonly minDate?: DayKey | null;
  readonly maxDate?: DayKey | null;
  /**
   * The business rule. The calendar itself has no opinion about weekends, past
   * dates or blackout windows — a component that decided any of those would
   * have to be argued with by every screen that disagreed.
   */
  readonly isDateDisabled?: (day: DayKey) => boolean;
  readonly weekStart?: WeekStart;
  readonly locale?: string;
  /** Take focus on mount — what a popover wants, and an inline calendar does not. */
  readonly autoFocus?: boolean;
  readonly className?: string;
  /** A row under the grid: the cell editor puts Clear and the time there. */
  readonly footer?: ReactNode;
}

/**
 * A month, drawn.
 *
 * Presentation and keyboard only: it holds the month on screen and where the
 * focus ring sits, and nothing else. The selected day belongs to whoever
 * rendered it, so paging through the year cannot change a record — which is
 * the whole reason browsing is separate from choosing.
 *
 * Days outside the month are shown and are selectable. Greying them out and
 * then accepting the click, or showing them and refusing it, are both ways of
 * lying about what the square does; muted-but-live is the honest one, and
 * picking one moves the calendar onto its month.
 *
 * A day the caller has ruled out is `aria-disabled` rather than `disabled`.
 * A disabled button cannot be focused, so the arrow keys would have to jump
 * over it silently — this way the cursor lands on it, a reader says
 * "unavailable", and Enter does nothing.
 */
export function Calendar({
  value = null,
  onSelect,
  today = todayKey(),
  minDate = null,
  maxDate = null,
  isDateDisabled,
  weekStart = DEFAULT_WEEK_START,
  locale = DEFAULT_DATE_LOCALE,
  autoFocus = false,
  className,
  footer,
}: CalendarProps) {
  const titleId = useId();

  /**
   * The month the calendar opens on, derived rather than stored.
   *
   * `anchor` is the month the value belongs to. Paging remembers which anchor
   * it was paging away from, so a new value — the user picked a day, or the
   * record changed underneath — snaps the view back to it without an effect
   * that fights the render it is reacting to.
   */
  const anchor = startOfMonthKey(clampDayKey(value ?? today, minDate, maxDate));
  const [browsed, setBrowsed] = useState<{ anchor: DayKey; month: DayKey } | null>(null);
  const month = browsed?.anchor === anchor ? browsed.month : anchor;

  /** Where the focus ring is. One day in the grid is tabbable; the rest are not. */
  const [focused, setFocused] = useState<{ anchor: DayKey; day: DayKey } | null>(null);
  const focusedDay = focused?.anchor === anchor ? focused.day : null;

  /**
   * The one tabbable day: whichever of the arrowed-to day, the selection and
   * today is on screen, and the first of the month when none of them is.
   *
   * Falling back to the month is not a nicety. The tab stop has to be a square
   * the grid is actually drawing — a cursor left behind on 27 August while the
   * grid shows September is a calendar with no tab stop at all, which the
   * keyboard cannot enter and Tab skips straight over.
   */
  const preferred = focusedDay ?? value ?? today;
  const cursor = isSameMonth(preferred, month) ? preferred : month;

  const grid = useRef<HTMLDivElement>(null);
  /** Set only when *we* moved the cursor, so a re-render never steals focus. */
  const shouldFocus = useRef(autoFocus);

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-day="${cursor}"]`)?.focus();
  }, [cursor]);

  /**
   * Move the cursor, and bring the month with it.
   *
   * `moveFocus` is the difference between the two ways here: the arrow keys
   * move the focus ring and DOM focus together, while the month buttons move
   * only the ring — pulling focus onto a day would take it off the button the
   * user is clicking, so the second click would have nothing under it.
   */
  const goTo = useCallback(
    (day: DayKey, moveFocus: boolean) => {
      const clamped = clampDayKey(day, minDate, maxDate);
      // Arrowing off the end of the range clamps back onto the day you are
      // already on. Setting state to what it already is renders nothing, so
      // the pending-focus flag would sit armed and be spent on whatever
      // re-render came next — stealing focus from wherever it had moved to.
      if (clamped === cursor) return;

      if (moveFocus) shouldFocus.current = true;
      setFocused({ anchor, day: clamped });
      setBrowsed({ anchor, month: startOfMonthKey(clamped) });
    },
    [anchor, cursor, minDate, maxDate],
  );

  /** A whole month, from the button. The day of the month is kept and clamped. */
  const page = useCallback(
    (delta: number) => goTo(addMonthsToKey(cursor, delta), false),
    [cursor, goTo],
  );

  const isDisabled = useCallback(
    (day: DayKey) => !isWithinRange(day, minDate, maxDate) || (isDateDisabled?.(day) ?? false),
    [minDate, maxDate, isDateDisabled],
  );

  const choose = useCallback(
    (day: DayKey) => {
      if (isDisabled(day)) return;
      setFocused({ anchor, day });
      // A day borrowed from a neighbouring month brings the calendar with it,
      // so the grid does not stay on a month the selection is no longer in.
      setBrowsed({ anchor, month: startOfMonthKey(day) });
      onSelect(day);
    },
    [anchor, isDisabled, onSelect],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = KEY_STEPS[event.key];
      if (step === undefined) return;

      event.preventDefault();
      // Arrowing inside a grid is not the same gesture as arrowing through a
      // table of cells behind the popover, and only one of them should act.
      event.stopPropagation();

      if (step.days !== undefined) goTo(addDaysToKey(cursor, step.days), true);
      else if (step.months !== undefined) goTo(addMonthsToKey(cursor, step.months), true);
      else if (step.edge === "start") goTo(startOfWeekKey(cursor, weekStart), true);
      else if (step.edge === "end") goTo(addDaysToKey(startOfWeekKey(cursor, weekStart), 6), true);
    },
    [cursor, weekStart, goTo],
  );

  const weeks = buildCalendarWeeks(month, weekStart);
  const headings = weekdayHeadings(weekStart, locale);

  const canGoBack = !minDate || compareDayKeys(startOfMonthKey(minDate), month) < 0;
  const canGoForward = !maxDate || compareDayKeys(month, startOfMonthKey(maxDate)) < 0;

  return (
    /* Seven 2rem squares, so the header spans exactly the grid under it
       rather than leaving a ragged edge on one side of it. */
    <div className={cn("w-[14rem] select-none", className)}>
      <div className="flex items-center justify-between gap-1 pb-2">
        <IconButton
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => page(-1)}
        >
          <ChevronLeft />
        </IconButton>

        <span id={titleId} aria-live="polite" className="text-ui font-medium text-foreground">
          {monthTitle(month, locale)}
        </span>

        <IconButton
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => page(1)}
        >
          <ChevronRight />
        </IconButton>
      </div>

      <div ref={grid} role="grid" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
        <div role="row" className="flex">
          {headings.map((heading) => (
            <div
              key={heading.long}
              role="columnheader"
              aria-label={heading.long}
              className="flex size-8 items-center justify-center text-micro font-medium text-faint-foreground"
            >
              {heading.short}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0]?.key} role="row" className="flex">
            {week.map((day) => {
              const isSelected = value === day.key;
              const isToday = day.key === today;
              const disabled = isDisabled(day.key);

              return (
                <div
                  key={day.key}
                  role="gridcell"
                  aria-selected={isSelected}
                  className="flex size-8 items-center justify-center"
                >
                  <button
                    type="button"
                    data-day={day.key}
                    tabIndex={day.key === cursor ? 0 : -1}
                    aria-disabled={disabled || undefined}
                    aria-current={isToday ? "date" : undefined}
                    // The number alone reads as "twenty-seven" with no month
                    // and no weekday, which is unusable in a grid you are
                    // navigating one square at a time.
                    aria-label={formatDayKey(day.key, DAY_LABEL_FORMAT, locale)}
                    onClick={() => choose(day.key)}
                    onFocus={() => setFocused({ anchor, day: day.key })}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md text-ui outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      disabled
                        ? "is-disabled cursor-not-allowed text-faint-foreground"
                        : "cursor-pointer",
                      // Ordered least to most specific, because a day can be
                      // several of these at once and only the last should show:
                      // today is a hint, the selection is a fact.
                      !isSelected && !disabled && "hover:bg-hover",
                      !isSelected && day.isOutsideMonth && "text-faint-foreground",
                      !isSelected && !day.isOutsideMonth && !disabled && "text-foreground",
                      !isSelected && isToday && "bg-hover font-semibold text-foreground",
                      isSelected && "bg-accent font-medium text-accent-foreground hover:bg-accent-hover",
                    )}
                  >
                    {day.dayOfMonth}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {footer}
    </div>
  );
}

/** What each navigation key moves by. `Home`/`End` are within the week. */
const KEY_STEPS: Readonly<
  Record<string, { days?: number; months?: number; edge?: "start" | "end" } | undefined>
> = {
  ArrowLeft: { days: -1 },
  ArrowRight: { days: 1 },
  ArrowUp: { days: -7 },
  ArrowDown: { days: 7 },
  PageUp: { months: -1 },
  PageDown: { months: 1 },
  Home: { edge: "start" },
  End: { edge: "end" },
};
