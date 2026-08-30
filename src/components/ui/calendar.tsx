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
  readonly value?: DayKey | null;
  readonly onSelect: (day: DayKey) => void;
  readonly today?: DayKey;
  readonly minDate?: DayKey | null;
  readonly maxDate?: DayKey | null;
  readonly isDateDisabled?: (day: DayKey) => boolean;
  readonly weekStart?: WeekStart;
  readonly locale?: string;
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly footer?: ReactNode;
}

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

  const anchor = startOfMonthKey(clampDayKey(value ?? today, minDate, maxDate));
  const [browsed, setBrowsed] = useState<{ anchor: DayKey; month: DayKey } | null>(null);
  const month = browsed?.anchor === anchor ? browsed.month : anchor;

  const [focused, setFocused] = useState<{ anchor: DayKey; day: DayKey } | null>(null);
  const focusedDay = focused?.anchor === anchor ? focused.day : null;

  const preferred = focusedDay ?? value ?? today;
  const cursor = isSameMonth(preferred, month) ? preferred : month;

  const grid = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(autoFocus);

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-day="${cursor}"]`)?.focus();
  }, [cursor]);

  const goTo = useCallback(
    (day: DayKey, moveFocus: boolean) => {
      const clamped = clampDayKey(day, minDate, maxDate);
      if (clamped === cursor) return;

      if (moveFocus) shouldFocus.current = true;
      setFocused({ anchor, day: clamped });
      setBrowsed({ anchor, month: startOfMonthKey(clamped) });
    },
    [anchor, cursor, minDate, maxDate],
  );

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
                    aria-label={formatDayKey(day.key, DAY_LABEL_FORMAT, locale)}
                    onClick={() => choose(day.key)}
                    onFocus={() => setFocused({ anchor, day: day.key })}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md text-ui outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      disabled
                        ? "is-disabled cursor-not-allowed text-faint-foreground"
                        : "cursor-pointer",
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
