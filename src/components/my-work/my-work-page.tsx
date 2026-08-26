"use client";

import { AlarmClock, AtSign, Briefcase, CalendarClock, History, UserCheck, type LucideIcon } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { WidgetCard } from "@/components/my-work/widget-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyWork } from "@/hooks/use-my-work";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import type { MyWorkWidgetId } from "@/types";

const WIDGET_ICONS: Readonly<Record<MyWorkWidgetId, LucideIcon>> = {
  assigned: UserCheck,
  mentioned: AtSign,
  dueToday: CalendarClock,
  overdue: AlarmClock,
  recentlyUpdated: History,
};

/**
 * My Work (CO-MYW-30).
 *
 * Five readings of the boards the user can see — never a separate dataset, so
 * a record edited on its board is reflected here on the next load without any
 * syncing step.
 */
export function MyWorkPage() {
  const resource = useMyWork();
  const openEntity = useOpenEntity();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Briefcase className="size-4 text-accent" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-foreground">My Work</h1>
          <p className="metric truncate text-[11px] text-faint-foreground">
            Everything with your name on it, across every board you can open
          </p>
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        <AsyncBoundary state={resource.state} onRetry={resource.reload} loading={<WidgetSkeletons />}>
          {(widgets) => (
            <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {widgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  icon={WIDGET_ICONS[widget.id]}
                  tone={widget.id === "overdue" ? "danger" : "neutral"}
                  onOpen={(item) => openEntity(item.ref)}
                />
              ))}
            </div>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}

function WidgetSkeletons() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <Skeleton className="h-4 w-32" />
          {[80, 65, 72].map((width, row) => (
            <Skeleton key={row} className="h-3.5" style={{ width: `${width}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
