"use client";

import { type LucideIcon } from "lucide-react";
import { WorkItemRow } from "@/components/my-work/work-item-row";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MyWorkItem, MyWorkWidget } from "@/types";

interface WidgetCardProps {
  readonly widget: MyWorkWidget;
  readonly icon: LucideIcon;
  readonly tone?: "neutral" | "danger";
  readonly onOpen: (item: MyWorkItem) => void;
}

export function WidgetCard({ widget, icon: Icon, tone = "neutral", onOpen }: WidgetCardProps) {
  const hidden = widget.total - widget.items.length;

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg border",
            tone === "danger" ? "border-danger/30 bg-danger/10" : "border-border bg-canvas",
          )}
        >
          <Icon className={cn("size-3.5", tone === "danger" ? "text-danger" : "text-accent")} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-lead font-semibold text-foreground">
            {widget.label}
          </span>
          <span className="metric block truncate text-micro text-faint-foreground">
            {widget.description}
          </span>
        </span>

        <Badge variant={widget.total > 0 && tone === "danger" ? "danger" : "default"}>
          {widget.total}
        </Badge>
      </header>

      {widget.items.length === 0 ? (
        <p className="px-3 py-6 text-center text-ui text-faint-foreground">
          Nothing here right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 p-1.5">
          {widget.items.map((item) => (
            <li key={item.id}>
              <WorkItemRow item={item} onOpen={onOpen} isOverdue={tone === "danger"} />
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <p className="metric border-t border-hairline px-3 py-1.5 text-micro text-faint-foreground">
          {hidden} more on the boards
        </p>
      )}
    </section>
  );
}
