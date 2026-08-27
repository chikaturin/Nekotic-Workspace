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
  readonly onToday: () => void;
  readonly hasToday: boolean;
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
  onToday,
  hasToday,
  summary,
}: GanttToolbarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!hasToday}
        title={hasToday ? "Scroll to today" : "Today is outside this range"}
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

      <Button
        size="sm"
        variant={showDependencies ? "subtle" : "ghost"}
        aria-pressed={showDependencies}
        className="gap-1.5"
        title="Draw the blocked-by connectors"
        onClick={onToggleDependencies}
      >
        {showDependencies ? <GitBranch /> : <Link2Off />}
        <span className="hidden sm:inline">Dependencies</span>
      </Button>

      <span className="metric ml-auto truncate text-[11px] text-faint-foreground">{summary}</span>
    </header>
  );
}
