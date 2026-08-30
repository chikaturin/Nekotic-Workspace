"use client";

import { CalendarClock, LayoutDashboard, ListChecks, ShieldCheck, type LucideIcon } from "lucide-react";
import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import { formatCount } from "@/lib/format";
import { nodeRef } from "@/lib/entity-ref";
import { findNodeById } from "@/lib/tree";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DashboardWidgetId } from "@/types";

const WIDGET_ICONS: Readonly<Record<DashboardWidgetId, LucideIcon>> = {
  tasks: ListChecks,
  qa: ShieldCheck,
  deadlines: CalendarClock,
};

function widgetIcon(id: DashboardWidgetId): LucideIcon {
  return WIDGET_ICONS[id] ?? LayoutDashboard;
}

export function DashboardPage() {
  const resource = useDashboard();
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);
  const openEntity = useOpenEntity();

  function openBoard(nodeId: string) {
    const node = findNodeById(tree, nodeId);
    if (node) openEntity(nodeRef(node));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <LayoutDashboard className="size-4 text-accent" />
        </span>

        <div className="min-w-0">
          <h1 className="text-title font-semibold tracking-tight text-foreground">
            {workspace.name}
          </h1>
          <p className="metric truncate text-body text-faint-foreground">
            {resource.state.status === "success"
              ? `${formatCount(resource.state.data.recordCount, "record")} across ${formatCount(
                  resource.state.data.boardCount,
                  "board",
                )}`
              : "Reading your boards"}
          </p>
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        <AsyncBoundary
          state={resource.state}
          onRetry={resource.reload}
          loading={<WidgetSkeletons />}
          isEmpty={(summary) => summary.isNewWorkspace}
          empty={<OnboardingPanel />}
        >
          {(summary) => (
            <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {summary.widgets.map((widget) => (
                <DashboardWidget
                  key={widget.id}
                  widget={widget}
                  icon={widgetIcon(widget.id)}
                  onOpenSource={openBoard}
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
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-3.5 flex-1" style={{ maxWidth: "55%" }} />
          </div>
          <Skeleton className="h-1.5 rounded-full" />
          {[70, 55, 62, 48].map((width, row) => (
            <Skeleton key={row} className="h-3" style={{ width: `${width}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
