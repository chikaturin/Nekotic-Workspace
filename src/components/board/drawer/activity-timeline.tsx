"use client";

import { ArrowRight, History, TriangleAlert } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useRowActivity } from "@/hooks/use-row-activity";
import { activityTime, describeActivity, displayValue } from "@/lib/activity";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/types";

export function ActivityTimeline({ boardId, rowId }: { boardId: string; rowId: string }) {
  const { state, days, total } = useRowActivity(boardId, rowId);

  if (state.status === "loading") {
    return (
      <div className="space-y-2 px-5 py-4" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-8" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <TriangleAlert className="size-5 text-danger" />
        <p className="text-ui text-foreground">{state.error.message}</p>
        <p className="metric text-body text-faint-foreground">
          {state.error.detail ?? "The history did not load. Nothing was changed."}
        </p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <History className="size-5 text-faint-foreground" />
        <p className="text-ui text-muted-foreground">
          Nothing has happened to this record yet.
        </p>
        <p className="metric text-body text-faint-foreground">
          Every edit, comment and attachment lands here as it happens.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <p className="metric mb-3 text-micro uppercase tracking-wider text-faint-foreground">
        {formatCount(total, "event")}
      </p>

      <div className="space-y-4">
        {days.map((day) => (
          <section key={day.key}>
            <h4 className="sticky top-0 z-sticky -mx-1 bg-background/90 px-1 pb-1.5 text-body font-semibold text-foreground backdrop-blur">
              {day.label}
            </h4>

            <ol className="space-y-2.5 border-l border-hairline pl-3">
              {day.entries.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function TimelineEntry({ entry }: { entry: ActivityEntry }) {
  return (
    <li className="relative" title={describeActivity(entry)}>
      <span
        aria-hidden
        className={cn(
          "absolute -left-[15px] top-2 size-1.5 rounded-full",
          entry.changes.length > 0 ? "bg-accent" : "bg-border-strong",
        )}
      />

      <div className="flex items-baseline gap-2">
        <span className="metric shrink-0 text-body tabular-nums text-faint-foreground">
          {activityTime(entry.createdAt)}
        </span>
        <UserAvatar user={entry.actor} className="size-4 shrink-0 self-center" />
        <span className="min-w-0 flex-1 text-ui leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{entry.actor.name}</span> {entry.summary}
        </span>
      </div>

      {entry.changes.length > 0 && (
        <ul className="mt-1 space-y-1 pl-[52px]">
          {entry.changes.map((change, index) => (
            <li key={`${change.columnName}_${index}`} className="flex flex-wrap items-center gap-1.5">
              <span className="metric text-micro uppercase tracking-wide text-faint-foreground">
                {change.columnName}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-body">
                <span className="max-w-40 truncate rounded bg-danger/10 px-1.5 py-px text-danger line-through decoration-danger/40">
                  {displayValue(change.from)}
                </span>
                <ArrowRight className="size-3 shrink-0 text-faint-foreground" />
                <span className="max-w-40 truncate rounded bg-success/10 px-1.5 py-px text-success">
                  {displayValue(change.to)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
