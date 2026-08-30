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
  readonly value: DayKey | null;
  readonly onChange: (day: DayKey | null) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly clearable?: boolean;
  readonly minDate?: DayKey | null;
  readonly maxDate?: DayKey | null;
  readonly isDateDisabled?: (day: DayKey) => boolean;
  readonly today?: DayKey;
  readonly weekStart?: WeekStart;
  readonly locale?: string;
  readonly displayFormat?: (day: DayKey) => string;
  readonly size?: DatePickerSize;
  readonly variant?: "default" | "ghost";
  readonly id?: string;
  readonly className?: string;
  readonly align?: "start" | "center" | "end";
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | undefined;
  readonly required?: boolean | undefined;
}

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
  const canClear = clearable && !required && value !== null;

  return (
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

function defaultFormat(locale: string): (day: DayKey) => string {
  return (day) => formatDayKey(day, DAY_FORMAT, locale);
}

export type { DayKey, WeekStart };
