"use client";

import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Shared shell for a read-only cell: one line, ellipsis, no layout surprises. */
export function CellShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-w-0 items-center gap-1.5 px-2", className)}>{children}</div>
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
          <span className="min-w-0 truncate text-[12px]">{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Kept as text — this column could not parse the value</TooltipContent>
    </Tooltip>
  );
}

/** Popover surface used by the editors that need more room than the cell. */
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
        "absolute left-0 top-0 z-50 min-w-full rounded-md border border-accent bg-elevated shadow-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
