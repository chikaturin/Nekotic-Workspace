"use client";

import { TriangleAlert } from "lucide-react";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import type { GanttRow } from "@/lib/board-gantt";
import { cn } from "@/lib/utils";
import type { SelectColor } from "@/types";

interface GanttBarProps {
  readonly row: GanttRow;
  readonly dayWidth: number;
  readonly label: string;
  /** Status colour from the record's own Select option — never a literal. */
  readonly color: SelectColor | null;
  readonly isOpen: boolean;
  readonly hasConflict: boolean;
  readonly tooltip: string;
  readonly onOpen: () => void;
}

/** Below this a bar has no room for a name, so it does not pretend to. */
const LABEL_MIN_WIDTH = 56;

/**
 * One record's duration, drawn as a duration.
 *
 * The bar runs from the record's start to its end, both days included, so its
 * width *is* the answer to "how long does this take". Nothing else is inferred:
 * a record without both dates has no bar at all, and is listed as unscheduled
 * rather than reduced to a marker that would look identical to a real one-day
 * task.
 *
 * A parent's summary bar is drawn heavier and flatter than its children's, so
 * the shape of the plan reads before any of the text does. Colour comes from
 * the record's own Status option — the chart decides no colours of its own.
 *
 * Read-only: the chart shows a schedule, it does not edit one. Dates are
 * changed in the drawer or the grid, which is why a click opens the record.
 */
export function GanttBar({
  row,
  dayWidth,
  label,
  color,
  isOpen,
  hasConflict,
  tooltip,
  onOpen,
}: GanttBarProps) {
  const { schedule } = row;
  if (!schedule) return null;

  const width = schedule.span * dayWidth;
  const isSummary = row.kind === "summary" || row.hasChildren;

  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      onClick={onOpen}
      style={{ left: schedule.offset * dayWidth, width: Math.max(width, 3) }}
      className={cn(
        "absolute flex cursor-pointer items-center overflow-hidden border text-left transition-shadow",
        // A parent reads as the span its children occupy: thicker, squarer,
        // and sat slightly higher than the rows it summarises.
        isSummary
          ? "top-[7px] h-[13px] rounded-[3px]"
          : "top-[10px] h-[9px] rounded-full",
        row.isDerived
          ? "border-border-strong bg-border-strong/70"
          : color
            ? SELECT_COLOR_CLASSES[color]
            : "border-accent/40 bg-accent/30",
        isOpen && "ring-1 ring-accent ring-offset-1 ring-offset-canvas",
        hasConflict && "outline outline-1 outline-offset-1 outline-warning/70",
      )}
    >
      {row.progress && (
        <span
          aria-hidden
          style={{ width: `${row.progress.percent}%` }}
          className="absolute inset-y-0 left-0 bg-foreground/20"
        />
      )}

      {isSummary && width >= LABEL_MIN_WIDTH && (
        <span className="relative truncate px-1.5 text-[10px] leading-none text-foreground">
          {hasConflict && <TriangleAlert className="mr-1 inline size-2.5 text-warning" />}
          {label}
        </span>
      )}
    </button>
  );
}
