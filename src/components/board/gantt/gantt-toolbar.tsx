"use client";

import { CalendarClock, GitBranch } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TIMELINE_ZOOMS, ZOOM_LABELS } from "@/lib/board-timeline";
import { cn } from "@/lib/utils";
import type { GanttZoom } from "@/types";

interface GanttToolbarProps {
  readonly zoom: GanttZoom;
  readonly onZoomChange: (zoom: GanttZoom) => void;
  readonly showDependencies: boolean;
  readonly onToggleDependencies: () => void;
  readonly linkCount: number;
  readonly onToday: () => void;
  readonly summary: string;
}

function isGanttZoom(value: string): value is GanttZoom {
  return TIMELINE_ZOOMS.some((level) => level === value);
}

export function GanttToolbar({
  zoom,
  onZoomChange,
  showDependencies,
  onToggleDependencies,
  linkCount,
  onToday,
  summary,
}: GanttToolbarProps) {
  const hasLinks = linkCount > 0;
  const hintId = useId();

  const dependencyHint = hasLinks
    ? `Draw the ${linkCount} blocked-by connector${linkCount === 1 ? "" : "s"}`
    : "Nothing on this board is blocked by another record yet — fill in a Blocked by field to see connectors";

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

      <ToggleGroup
        size="sm"
        aria-label="Timeline zoom"
        value={zoom}
        onValueChange={(next) => {
          if (isGanttZoom(next)) onZoomChange(next);
        }}
      >
        {TIMELINE_ZOOMS.map((level) => (
          <ToggleGroupItem key={level} value={level}>
            {ZOOM_LABELS[level]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <label
        className={cn(
          "flex h-[var(--control-sm)] items-center gap-2 rounded-md border border-border bg-surface px-[var(--control-pad-sm)]",
          hasLinks ? "cursor-pointer" : "is-disabled",
        )}
      >
        <GitBranch aria-hidden="true" className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="hidden text-body text-muted-foreground sm:inline">Dependencies</span>
        <span className="metric text-micro text-faint-foreground">{linkCount}</span>
        <Switch
          size="sm"
          checked={showDependencies}
          disabled={!hasLinks}
          title={dependencyHint}
          aria-label="Draw dependency connectors"
          aria-describedby={hintId}
          onCheckedChange={() => onToggleDependencies()}
        />
        <span id={hintId} className="sr-only">
          {dependencyHint}
        </span>
      </label>

      <span className="metric ml-auto truncate text-body text-faint-foreground">{summary}</span>
    </header>
  );
}
