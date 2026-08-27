"use client";

import { Maximize2 } from "lucide-react";
import { CellShell } from "@/components/board/cells/cell-frame";
import { estimateLines, WRAP_MAX_LINES } from "@/lib/cell-display";
import { cn } from "@/lib/utils";
import type { CellDisplayMode } from "@/types";

/**
 * The body of a text cell, in whichever of the three shapes the view asks for.
 *
 * Compact is one clipped line and is what every text cell has always been.
 * Wrap flows to a few lines and clips; Full flows to all of them — the row has
 * already been made tall enough for either, so this only has to lay the text
 * out and stay inside the height it was given.
 *
 * Compact keeps one extra thing: a way to read what was clipped. It marks
 * itself `data-cell-expand`, which is the attribute the grid already treats as
 * "open this cell" on a single click — the same mechanism the `+4` on a chip
 * list uses, rather than a second one invented for text. A tooltip would not
 * do: a step is several lines, and several lines is exactly what a tooltip
 * cannot show.
 */
export function FlowedText({
  text,
  mode,
  width,
  className,
  isInteractive = true,
}: {
  readonly text: string;
  readonly mode: CellDisplayMode;
  /** The column's width, used to tell a clipped value from one that fits. */
  readonly width: number;
  readonly className?: string;
  /** False on a read-only board, where no click will open an editor. */
  readonly isInteractive?: boolean;
}) {
  if (mode === "compact") {
    // Offered only where something is actually hidden. A value that fits needs
    // no way to be expanded, and an affordance on every cell in the column is
    // noise rather than help.
    const isClipped = estimateLines(text, width, "full") > 1;

    return (
      <CellShell>
        <span className={cn("min-w-0 truncate", className)} title={text}>
          {text}
        </span>

        {/* Only where there is something to open, and only where opening it
            leads somewhere. */}
        {isClipped && isInteractive && (
          <span
            data-cell-expand=""
            aria-hidden="true"
            title="Show the whole value"
            className="ml-auto hidden shrink-0 rounded p-0.5 text-faint-foreground hover:bg-hover hover:text-foreground group-hover/cell:flex"
          >
            <Maximize2 className="size-3" />
          </span>
        )}
      </CellShell>
    );
  }

  return (
    <CellShell isFlowed>
      <span
        className={cn("min-w-0 whitespace-pre-wrap break-words", className)}
        style={
          mode === "wrap"
            ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: WRAP_MAX_LINES,
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </span>
    </CellShell>
  );
}
