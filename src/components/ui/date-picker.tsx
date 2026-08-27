"use client";

import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { inputVariants } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DAY_FORMAT,
  DEFAULT_DATE_LOCALE,
  DEFAULT_WEEK_START,
  formatDayKey,
  todayKey,
  type DayKey,
  type WeekStart,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type DatePickerSize = "xs" | "sm" | "md";

export interface DatePickerProps {
  /**
   * The chosen day as `YYYY-MM-DD`, or null.
   *
   * A day key rather than a timestamp, deliberately. A date-only field is a
   * square on a calendar; the moment it becomes an instant, the zone it was
   * turned into one in decides whether the 27th survives being read back.
   * Callers that store instants convert at the edge with `withDayKey`.
   */
  readonly value: DayKey | null;
  readonly onChange: (day: DayKey | null) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Offers the X in the trigger. Leave off for a field that must hold a date. */
  readonly clearable?: boolean;
  readonly minDate?: DayKey | null;
  readonly maxDate?: DayKey | null;
  /** A business rule, passed in — see `Calendar`. */
  readonly isDateDisabled?: (day: DayKey) => boolean;
  readonly today?: DayKey;
  readonly weekStart?: WeekStart;
  readonly locale?: string;
  /**
   * How the chosen day is written on the trigger. Defaults to the shape the
   * rest of the app renders dates in, so a picker and the cell it edits agree.
   */
  readonly displayFormat?: (day: DayKey) => string;
  readonly size?: DatePickerSize;
  readonly variant?: "default" | "ghost";
  readonly id?: string;
  readonly className?: string;
  readonly align?: "start" | "center" | "end";
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  readonly "aria-describedby"?: string;
  /** Draws the invalid state — `FormField` supplies it. Validation is the form's. */
  readonly "aria-invalid"?: boolean | undefined;
  /**
   * Takes the X away: a field that must hold a date has no "no date" to offer.
   *
   * It does not reach the DOM — `required` and `aria-required` are both invalid
   * on a button, which is what a picker's trigger is — so the caption's marker
   * and the form's own validation are what announce it. `FormField` passes this
   * through its render prop, so `{...field}` wires it up.
   */
  readonly required?: boolean | undefined;
}

/**
 * Pick one day.
 *
 * One date, one click, no Apply button: there is nothing to confirm when the
 * only decision is which square, so choosing closes the popover and writes the
 * value. Range, time and multi-select are all deliberately absent — a component
 * that did those too would carry their state and their edge cases into every
 * screen that only ever wanted a due date.
 *
 * It is controlled and holds no copy of the value. What it does own is which
 * month is on screen and whether the popover is open, neither of which is
 * business data: paging from August to December cannot change a record, and
 * closing without choosing leaves the field exactly as it was.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  clearable = false,
  minDate = null,
  maxDate = null,
  isDateDisabled,
  today = todayKey(),
  weekStart = DEFAULT_WEEK_START,
  locale = DEFAULT_DATE_LOCALE,
  displayFormat,
  size = "md",
  variant = "default",
  id,
  className,
  align = "start",
  required = false,
  ...aria
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const label = value ? (displayFormat ?? defaultFormat(locale))(value) : placeholder;
  /**
   * Only where there is something to clear, and only where the field is allowed
   * to be empty. A permanent Clear on a required date is an action that reports
   * failure every time it is taken.
   */
  const canClear = clearable && !required && value !== null;

  return (
    // Being switched off while open has to close the panel, not freeze it there:
    // gating `onOpenChange` alone would leave a popover nothing could dismiss.
    <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          {...aria}
          className={cn(
            inputVariants({ variant, size }),
            "group items-center gap-1.5 text-left",
            className,
          )}
        >
          <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-faint-foreground" />

          <span className={cn("min-w-0 flex-1 truncate", !value && "text-faint-foreground")}>
            {label}
          </span>

          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-faint-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        // Radix would otherwise focus the first tabbable thing in the panel,
        // which is the previous-month arrow. The calendar puts focus on the
        // day the arrow keys will move from instead.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-auto"
      >
        <Calendar
          value={value}
          today={today}
          minDate={minDate}
          maxDate={maxDate}
          {...(isDateDisabled ? { isDateDisabled } : {})}
          weekStart={weekStart}
          locale={locale}
          autoFocus
          onSelect={(day) => {
            onChange(day);
            setIsOpen(false);
          }}
          footer={
            canClear ? (
              /* Under the grid rather than as an X on the trigger, which is
                 where the Select puts its own. The Select's trigger is a div
                 and can hold a button; this one is a real <button>, and a
                 button inside a button is markup the HTML parser rewrites —
                 on a statically exported page that means the server and the
                 client disagree about the shape of the tree. */
              <div className="mt-2 border-t border-border pt-2">
                <Button
                  size="xs"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                >
                  <X />
                  Clear date
                </Button>
              </div>
            ) : null
          }
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * `27 Aug 2026`. Built per locale rather than inlined so a caller that only
 * wants a different locale does not have to supply a formatter as well.
 */
function defaultFormat(locale: string): (day: DayKey) => string {
  return (day) => formatDayKey(day, DAY_FORMAT, locale);
}


/** Re-exported so a consumer needs one import, not two. */
export type { DayKey, WeekStart };
