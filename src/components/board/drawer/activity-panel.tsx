"use client";

import { History } from "lucide-react";
import { useCallback } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { formatRelativeTime } from "@/lib/format";
import { boardService } from "@/services/board-service";
import type { ActivityEntry } from "@/types";

/**
 * Activity log. The service records every write it serves, so this reflects
 * real mutations rather than a static list — the audit feed replaces it
 * one-for-one once the backend emits events.
 */
export function ActivityPanel({ boardId, rowId }: { boardId: string; rowId: string }) {
  const loader = useCallback(
    (signal: AbortSignal) => boardService.listActivity(boardId, rowId, signal),
    [boardId, rowId],
  );

  const { state } = useAsyncResource<readonly ActivityEntry[]>(loader);
  const entries = state.status === "success" ? state.data : [];

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
        <History className="size-3.5" />
        Activity
      </h3>

      <ol className="space-y-1.5 border-l border-hairline pl-3">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2">
            <UserAvatar user={entry.actor} className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
              <span className="text-foreground">{entry.actor.name}</span> {entry.summary}
            </span>
            <span className="metric shrink-0 text-[10px] text-faint-foreground">
              {formatRelativeTime(entry.createdAt)}
            </span>
          </li>
        ))}

        {entries.length === 0 && (
          <li className="text-[12px] text-faint-foreground">No activity recorded yet.</li>
        )}
      </ol>
    </section>
  );
}
