"use client";

import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Shared shell for a read-only cell: one line, ellipsis, no layout surprises.
 *
 * `overflow-hidden` is the load-bearing part. A cell's width is a CSS variable
 * the user set by dragging a column edge, and without a clip the content simply
 * ignored it — a Blocked by cell holding four links drew all four, straight
 * across whatever column came next. Clipping here rather than in each view is
 * what makes that true of every cell type at once, and it is why the chip lists
 * inside are free to be laid out in the obvious way.
 *
 * It also pins the row's height: the flex row does not wrap, so a cell with
 * twenty values is exactly as tall as one with none — which is the contract the
 * virtualiser is measuring rows against.
 */
export function CellShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 items-center gap-1.5 overflow-hidden px-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The "+4" that stands for the values a cell had no room for.
 *
 * It carries the full list as its title, so the whole set is one hover away
 * even where the grid is read-only and no editor will open. Where the cell *is*
 * editable, `GridCell` treats a click on it as "open this cell" — the marked
 * attribute is what it looks for.
 */
export function CellOverflowCount({ count, title }: { count: number; title: string }) {
  return (
    <span
      data-cell-expand=""
      title={title}
      className="metric shrink-0 rounded px-1 text-micro text-faint-foreground hover:bg-hover hover:text-foreground"
    >
      +{count}
    </span>
  );
}

/**
 * Marker for a value the column could not parse — a converted column keeps the
 * original text and flags it here instead of dropping the data.
 */
export function UnparsedBadge({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex min-w-0 items-center gap-1 text-warning">
          <TriangleAlert className="size-3 shrink-0" />
          <span className="min-w-0 truncate text-ui">{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Kept as text — this column could not parse the value</TooltipContent>
    </Tooltip>
  );
}

/**
 * Popover surface used by the editors that need more room than the cell.
 *
 * It sits at `z-raised`: above every other cell, and *below* the frozen row
 * gutter and primary column at `z-sticky`. That ordering is the whole fix for
 * the panel that used to bleed across the sticky ID column — it outranked the
 * frozen pane, so an editor opened on a cell scrolled part-way underneath was
 * painted straight over the top of it. A frozen column is the one thing in a
 * table that must never be drawn on; the panel goes behind it instead, and
 * `revealBeyondFrozen` scrolls the cell clear first so there is nothing left
 * hidden. Bumping the z-index the other way would have made the bleed worse.
 */
export function EditorSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 top-0 z-raised min-w-full rounded-md border border-accent bg-elevated shadow-float",
        className,
      )}
    >
      {children}
    </div>
  );
}
