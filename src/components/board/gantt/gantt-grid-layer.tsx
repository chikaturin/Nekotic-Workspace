"use client";

import { memo } from "react";
import { addDays, isWeekend } from "@/lib/board-dates";
import type { TimelineScale } from "@/lib/board-timeline";
import { cn } from "@/lib/utils";

interface GanttGridLayerProps {
  readonly scale: TimelineScale;
  readonly height: number;
}

const WEEKEND_MIN_DAY_WIDTH = 10;

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
    <div aria-hidden style={{ height }} className="pointer-events-none absolute inset-x-0 top-0 z-base">
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

      <div
        style={{ left: todayOffset * dayWidth }}
        className="absolute inset-y-0 z-raised w-px bg-accent"
      />
      <div
        style={{ left: todayOffset * dayWidth }}
        className="absolute inset-y-0 z-raised w-[3px] -translate-x-[1px] bg-accent/15"
      />
    </div>
  );
});
