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
 * itself `data-cell-detail`, which the grid reads as "open the reader" — the
 * same delegation the `+4` on a chip list uses, rather than a second mechanism
 * invented for text. It is not an editor and not gated on permission: reading
 * a value you can already see part of is not a write.
 */
export function FlowedText({
  text,
  mode,
  width,
  className,
  hasReader = false,
}: {
  readonly text: string;
  readonly mode: CellDisplayMode;
  /** The column's width, used to tell a clipped value from one that fits. */
  readonly width: number;
  readonly className?: string;
  /**
   * Whether the surface around this text delegates `data-cell-detail`.
   *
   * Only the grid does. Kanban cards, the subtask list and a board embedded in
   * a document all render cells too, and drawing a marker there would be an
   * affordance for a reader nobody would open — so they keep the tooltip they
   * have always had, which is the right instrument for a card's one-line
   * summary even where it is the wrong one for a table full of paragraphs.
   */
  readonly hasReader?: boolean;
}) {
  if (mode === "compact") {
    // Offered only where something is actually hidden. A value that fits needs
    // no way to be expanded, and an affordance on every cell in the column is
    // noise rather than help.
    const isClipped = estimateLines(text, width, "full") > 1;

    return (
      <CellShell>
        {/*
          A tooltip only where it is the only thing on offer, and only where
          something is actually hidden. On a clipped value with a reader behind
          it the tooltip is the wrong instrument — it appears under the
          pointer, sizes itself, cannot be scrolled or selected from, and
          vanishes as you move towards it. On a value that is not clipped it is
          pure noise: text repeated over text already on screen, announced
          twice by a screen reader, on every cell of a 5.000-row column.
        */}
        <span
          className={cn("min-w-0 truncate", className)}
          title={isClipped && !hasReader ? text : undefined}
        >
          {text}
        </span>

        {isClipped && hasReader && (
          <span
            data-cell-detail=""
            // Decoration, not a control: the cell around it owns the click,
            // and a role that promises a button without being focusable is a
            // promise to a keyboard user that nothing keeps. Enter on the cell
            // is the keyboard path — see `useGridKeyboard`.
            aria-hidden="true"
            title="Read the whole value"
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
