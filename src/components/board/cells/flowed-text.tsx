"use client";

import { Maximize2 } from "lucide-react";
import { CellShell } from "@/components/board/cells/cell-frame";
import { estimateLines, WRAP_MAX_LINES } from "@/lib/cell-display";
import { cn } from "@/lib/utils";
import type { CellDisplayMode } from "@/types";

export function FlowedText({
  text,
  mode,
  width,
  className,
  hasReader = false,
}: {
  readonly text: string;
  readonly mode: CellDisplayMode;
  readonly width: number;
  readonly className?: string;
  readonly hasReader?: boolean;
}) {
  if (mode === "compact") {
    const isClipped = estimateLines(text, width, "full") > 1;

    return (
      <CellShell>
        <span
          className={cn("min-w-0 truncate", className)}
          title={isClipped && !hasReader ? text : undefined}
        >
          {text}
        </span>

        {isClipped && hasReader && (
          <span
            data-cell-detail=""
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
