"use client";

import type { TimelineScale } from "@/lib/board-timeline";
import { cn } from "@/lib/utils";

interface GanttTimelineHeaderProps {
  readonly scale: TimelineScale;
  readonly height: number;
}

export function GanttTimelineHeader({ scale, height }: GanttTimelineHeaderProps) {
  const { dayWidth, bands, ticks, todayOffset } = scale;
  const rowHeight = height / 2;

  return (
    <div style={{ height }} className="relative">
      <div style={{ height: rowHeight }} className="relative border-b border-hairline">
        {bands.map((band) => (
          <div
            key={band.key}
            style={{ left: band.offset * dayWidth, width: band.days * dayWidth }}
            className="absolute inset-y-0 flex items-center overflow-hidden border-l border-border px-1.5"
          >
            <span className="truncate text-body font-medium text-foreground">{band.label}</span>
          </div>
        ))}
      </div>

      <div style={{ height: rowHeight }} className="relative">
        {ticks.map((tick) => (
          <div
            key={tick.iso}
            style={{ left: tick.offset * dayWidth }}
            className={cn(
              "absolute inset-y-0 flex items-center whitespace-nowrap border-l pl-1 text-micro",
              tick.isMajor ? "border-border text-muted-foreground" : "border-hairline text-faint-foreground",
            )}
          >
            {tick.label}
          </div>
        ))}

        <div
          aria-hidden
          style={{ left: todayOffset * dayWidth }}
          className="absolute inset-y-0 w-px bg-accent"
        />
      </div>
    </div>
  );
}
