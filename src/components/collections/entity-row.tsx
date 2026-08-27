"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EntityRowProps {
  readonly icon: LucideIcon;
  readonly iconClassName?: string;
  readonly title: string;
  readonly subtitle: string;
  readonly onOpen: () => void;
  /** Trailing controls — a star, a dismiss button. */
  readonly actions?: ReactNode;
}

/** One line in Favorites and Recent; both lists read identically by design. */
export function EntityRow({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  onOpen,
  actions,
}: EntityRowProps) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className={cn("size-4 shrink-0", iconClassName ?? "text-muted-foreground")} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lead text-foreground">{title}</span>
          <span className="metric block truncate text-micro text-faint-foreground">
            {subtitle}
          </span>
        </span>
      </button>

      {actions && <span className="flex shrink-0 items-center gap-0.5">{actions}</span>}
    </div>
  );
}
