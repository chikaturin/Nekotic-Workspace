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
  readonly color: SelectColor | null;
  readonly isOpen: boolean;
  readonly hasConflict: boolean;
  readonly tooltip: string;
  readonly onOpen: () => void;
}

const LABEL_MIN_WIDTH = 56;

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
        <span className="relative truncate px-2 text-body leading-none font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
          {hasConflict && <TriangleAlert className="mr-1 inline size-3" />}
          {label}
        </span>
      )}
    </button>
  );
}
