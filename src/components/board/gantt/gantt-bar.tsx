"use client";

import { TriangleAlert } from "lucide-react";
import { SELECT_SOLID_CLASSES, SELECT_TRACK_CLASSES } from "@/lib/board-schema";
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
 * It is drawn as a filled block rather than an outline, in two tones of one
 * colour: the whole bar in the status colour, and the finished share of it in
 * the same colour at full strength. Progress therefore reads as the bar getting
 * denser from the left, not as a foreign grey stripe laid over a hollow shape.
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
  const donePercent = Math.round(row.completionRatio * 100);

  // A derived range belongs to the subtasks, not to the record, so it stays
  // neutral: colouring it by a status the parent never set would claim more
  // than the data says.
  const track = row.isDerived
    ? "bg-border-strong/55"
    : color
      ? SELECT_TRACK_CLASSES[color]
      : "bg-accent/40";

  const fill = row.isDerived
    ? "bg-border-strong"
    : color
      ? SELECT_SOLID_CLASSES[color]
      : "bg-accent";

  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      onClick={onOpen}
      style={{ left: schedule.offset * dayWidth, width: Math.max(width, 3) }}
      className={cn(
        "absolute flex cursor-pointer items-center overflow-hidden rounded-[3px] text-left",
        "ring-1 ring-inset ring-border-strong/40 transition-shadow",
        // A parent reads as the span its children occupy: thicker, and sat
        // slightly higher than the rows it summarises.
        isSummary ? "top-[5px] h-[34px]" : "top-[7px] h-[30px]",
        track,
        isOpen && "ring-2 ring-accent",
        hasConflict && "outline outline-1 outline-offset-1 outline-warning/70",
      )}
    >
      {donePercent > 0 && (
        <span
          aria-hidden
          style={{ width: `${donePercent}%` }}
          className={cn("absolute inset-y-0 left-0", fill)}
        />
      )}

      {width >= LABEL_MIN_WIDTH && (
        <span className="relative truncate px-2 text-[11px] leading-none font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
          {hasConflict && <TriangleAlert className="mr-1 inline size-3" />}
          {label}
        </span>
      )}
    </button>
  );
}
