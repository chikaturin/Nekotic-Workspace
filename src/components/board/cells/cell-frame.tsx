"use client";

import { TriangleAlert } from "lucide-react";
import { useCallback, useRef, type ReactNode } from "react";
import { useDismissOnOutside } from "@/hooks/use-dismiss-on-outside";
import { GRID_SCROLLER_ATTR } from "@/lib/dom/grid-scroll";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CellShell({
  children,
  className,
  isFlowed = false,
}: {
  children: ReactNode;
  className?: string;
  isFlowed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 gap-1.5 overflow-hidden px-2",
        isFlowed ? "items-start py-1.5" : "items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

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

export function EditorSurface({
  children,
  className,
  onDismiss,
}: {
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => onDismiss?.(), [onDismiss]);

  const attach = useCallback((panel: HTMLDivElement | null) => {
    surface.current = panel;
    keepPanelInView(panel);
  }, []);

  useDismissOnOutside(surface, onDismiss ? dismiss : null);

  return (
    <div
      ref={attach}
      className={cn(
        "absolute left-0 top-0 z-raised min-w-full rounded-md border border-accent bg-elevated shadow-float",
        className,
      )}
    >
      {children}
    </div>
  );
}

const PANEL_EDGE_GAP = 8;

function keepPanelInView(panel: HTMLDivElement | null): void {
  if (!panel) return;

  const scroller = panel.closest<HTMLElement>(`[${GRID_SCROLLER_ATTR}]`);
  const limit = scroller
    ? scroller.getBoundingClientRect().right
    : document.documentElement.clientWidth;

  if (panel.getBoundingClientRect().right + PANEL_EDGE_GAP <= limit) return;

  panel.style.left = "auto";
  panel.style.right = "0";
}

