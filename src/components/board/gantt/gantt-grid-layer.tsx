"use client";

import { memo } from "react";
import { addDays, isWeekend } from "@/lib/board-dates";
import type { TimelineScale } from "@/lib/board-timeline";
import { cn } from "@/lib/utils";

interface GanttGridLayerProps {
  readonly scale: TimelineScale;
  /** Full height of the chart body, padding rows included. */
  readonly height: number;
}

/** Below this a weekend stripe would be thinner than the line beside it. */
const WEEKEND_MIN_DAY_WIDTH = 10;

/**
 * The chart's background, drawn once.
 *
 * Weekend shading, the vertical time rules and today's line are one layer
 * behind every bar rather than something each row draws for itself. That is
 * what lets a rule actually run the full height of the chart — a per-row
 * fragment stops at each row's border and gives the eye nothing to follow — and
 * it means the cost is the width of the window, not the number of records.
 *
 * The rules sit on the tick boundaries the header already labels, so the line
 * under "31 Aug" is the same line the header names. At a scale where a day is
 * three pixels wide there is no daily rule, because the header has no daily
 * label either.
 */
export const GanttGridLayer = memo(function GanttGridLayer({
  scale,
  height,
}: GanttGridLayerProps) {
  const { dayWidth, startIso, dayCount, ticks, todayOffset } = scale;

  const weekends: number[] = [];
  if (dayWidth >= WEEKEND_MIN_DAY_WIDTH) {
    for (let offset = 0; offset < dayCount; offset += 1) {
      if (isWeekend(addDays(startIso, offset))) weekends.push(offset);
    }
  }

  return (
    // `z-0` pins the whole layer under every bar, while still letting the
    // today line sit above the shading inside it.
    <div aria-hidden style={{ height }} className="pointer-events-none absolute inset-x-0 top-0 z-0">
      {weekends.map((offset) => (
        <div
          key={`weekend-${offset}`}
          style={{ left: offset * dayWidth, width: dayWidth }}
          className="absolute inset-y-0 bg-foreground/[0.035]"
        />
      ))}

      {ticks.map((tick) => (
        <div
          key={`rule-${tick.iso}`}
          style={{ left: tick.offset * dayWidth }}
          className={cn(
            "absolute inset-y-0 w-px",
            tick.isMajor ? "bg-border" : "bg-hairline",
          )}
        />
      ))}

      {/* Today is the one line worth interrupting the plan for. */}
      <div
        style={{ left: todayOffset * dayWidth }}
        className="absolute inset-y-0 z-10 w-px bg-accent"
      />
      <div
        style={{ left: todayOffset * dayWidth }}
        className="absolute inset-y-0 z-10 w-[3px] -translate-x-[1px] bg-accent/15"
      />
    </div>
  );
});
