"use client";

import { CalendarClock, GitBranch, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIMELINE_ZOOMS, ZOOM_LABELS } from "@/lib/board-timeline";
import { cn } from "@/lib/utils";
import type { GanttZoom } from "@/types";

interface GanttToolbarProps {
  readonly zoom: GanttZoom;
  readonly onZoomChange: (zoom: GanttZoom) => void;
  readonly showDependencies: boolean;
  readonly onToggleDependencies: () => void;
  /** How many blocked-by connectors the chart has to draw, shown or not. */
  readonly linkCount: number;
  readonly onToday: () => void;
  readonly summary: string;
}

/**
 * Four controls, and no more: where today is, how wide a day is drawn, whether
 * the dependency arrows are on, and what is currently on the chart. Filter,
 * sort and the date fields already have a home in the view config bar above,
 * so repeating them here would only give the reader two of everything.
 */
export function GanttToolbar({
  zoom,
  onZoomChange,
  showDependencies,
  onToggleDependencies,
  linkCount,
  onToday,
  summary,
}: GanttToolbarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        title="Scroll the timeline back to today"
        onClick={onToday}
      >
        <CalendarClock />
        Today
      </Button>

      <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
        {TIMELINE_ZOOMS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={zoom === level}
            onClick={() => onZoomChange(level)}
            className={cn(
              "rounded px-2 py-1 text-[11px] transition-colors",
              zoom === level
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {ZOOM_LABELS[level]}
          </button>
        ))}
      </div>

      {/* The count is the point: on a board where nothing is blocked by
          anything there is nothing to draw, and a toggle that looks identical
          either way reads as a button that does not work. */}
      <Button
        size="sm"
        variant={showDependencies ? "subtle" : "ghost"}
        aria-pressed={showDependencies}
        disabled={linkCount === 0}
        className="gap-1.5"
        title={
          linkCount === 0
            ? "Nothing on this board is blocked by another record yet — fill in a Blocked by field to see connectors"
            : `Draw the ${linkCount} blocked-by connector${linkCount === 1 ? "" : "s"}`
        }
        onClick={onToggleDependencies}
      >
        {showDependencies ? <GitBranch /> : <Link2Off />}
        <span className="hidden sm:inline">Dependencies</span>
        <span className="metric text-[10px] text-faint-foreground">{linkCount}</span>
      </Button>

      <span className="metric ml-auto truncate text-[11px] text-faint-foreground">{summary}</span>
    </header>
  );
}
