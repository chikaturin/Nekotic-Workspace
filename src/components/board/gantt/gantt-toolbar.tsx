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
  /** How many blocked-by connectors the chart has to draw, shown or not. */
  readonly linkCount: number;
  readonly onToday: () => void;
  readonly summary: string;
}

/**
 * A segmented control speaks in plain strings, because it has no idea what its
 * values mean. This is how one becomes a zoom again without a cast, and it is
 * why a value the timeline does not recognise never reaches the store.
 */
function isGanttZoom(value: string): value is GanttZoom {
  return TIMELINE_ZOOMS.some((level) => level === value);
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
  const hasLinks = linkCount > 0;
  const hintId = useId();

  // One sentence for the hover hint whichever way the switch is sitting, so
  // the two states cannot drift into explaining different things.
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

      {/* One choice out of four, which is what a radiogroup means and what the
          old `aria-pressed` buttons did not: four independent toggles, none of
          which said which one was on, and no arrow keys between them. */}
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

      {/* Whether the connectors are drawn is saved onto the view, so this is a
          switch rather than a pressed button: `aria-pressed` announces a
          momentary action, and this setting is still where you left it the
          next time anyone opens the board.

          The count is the point: on a board where nothing is blocked by
          anything there is nothing to draw, and a toggle that looks identical
          either way reads as a control that does not work. The label carries
          the hint and the dimming because the switch is disabled at zero, and
          a disabled control has no hover of its own to hang a title on. */}
      <label
        className={cn(
          "flex h-[var(--control-sm)] items-center gap-2 rounded-md border border-border bg-surface px-[var(--control-pad-sm)]",
          hasLinks ? "cursor-pointer" : "is-disabled",
        )}
      >
        <GitBranch aria-hidden="true" className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="hidden text-body text-muted-foreground sm:inline">Dependencies</span>
        <span className="metric text-micro text-faint-foreground">{linkCount}</span>
        {/* The hint rides on the control, not on the label around it: a
            `title` on a <label> contributes to neither the input's name nor
            its description, so the sentence explaining why the switch is
            refusing would have been hover-only — which is exactly the
            explanation a disabled control most needs to give. */}
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
