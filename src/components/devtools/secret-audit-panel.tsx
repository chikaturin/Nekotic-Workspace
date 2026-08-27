"use client";

import { ShieldCheck } from "lucide-react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { formatRelativeTime } from "@/lib/format";
import { devtoolsService } from "@/services/devtools-service";
import type { SecretAuditEntry } from "@/types";

/**
 * The document's own trail.
 *
 * Every reveal, copy and rotation, allowed or refused, with who and when — and
 * no values. A trail that recorded what was revealed would be a second copy of
 * the secrets, in a log, readable by everyone who can read logs.
 */
export function SecretAuditPanel({ nodeId }: { nodeId: string }) {
  const loader = useCallback(
    (signal: AbortSignal) => devtoolsService.listSecretAudit(nodeId, signal),
    [nodeId],
  );

  const { state } = useAsyncResource<readonly SecretAuditEntry[]>(loader, {
    keepPreviousData: true,
  });

  const entries = state.status === "success" ? state.data : [];

  return (
    <aside
      aria-label="Secret audit log"
      className="flex w-80 shrink-0 flex-col border-l border-border bg-background"
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b border-hairline px-3 py-2.5">
        <ShieldCheck aria-hidden="true" className="size-3.5 text-faint-foreground" />
        <h2 className="text-ui font-medium text-foreground">Audit log</h2>
        <span className="metric ml-auto text-micro text-faint-foreground">{entries.length}</span>
      </header>

      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-border bg-surface px-2.5 py-2">
            <div className="flex items-baseline gap-1.5">
              <Badge variant={entry.action === "rotate" ? "warning" : "accent"}>
                {entry.action}
              </Badge>
              <span className="metric min-w-0 flex-1 truncate text-body text-foreground">
                {entry.key}
              </span>
            </div>
            <p className="metric mt-1 truncate text-micro text-faint-foreground">
              {entry.actor.name} · {entry.ip} · {formatRelativeTime(entry.at)}
            </p>
          </li>
        ))}

        {entries.length === 0 && (
          <li className="px-1 py-6 text-center text-body text-faint-foreground">
            Nothing has been revealed in this session.
          </li>
        )}
      </ol>
    </aside>
  );
}
