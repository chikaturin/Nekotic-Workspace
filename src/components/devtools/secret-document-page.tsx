"use client";

import { Copy, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { environmentOption } from "@/components/devtools/environment-picker";
import { SelectChip } from "@/components/board/cells/select-cell";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListLoadingState } from "@/components/shared/state-panels";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useCapabilities, useWorkspaceRole } from "@/hooks/use-capabilities";
import { useSecretDocument } from "@/hooks/use-secret-document";
import { formatRelativeTime } from "@/lib/format";
import { devtoolsService } from "@/services/devtools-service";
import { cn } from "@/lib/utils";
import type { DocumentNode, SecretAuditEntry, SecretEntry } from "@/types";

/**
 * DV-SEC-23 — secrets shown as masks by default.
 *
 * The page never receives plaintext with the document: values arrive one at a
 * time from a permission-checked call, live in component state, and are dropped
 * on a timer. Nothing is persisted and nothing is logged.
 */
export function SecretDocumentPage({ node }: { node: DocumentNode }) {
  const capabilities = useCapabilities(node);
  const role = useWorkspaceRole();
  const controller = useSecretDocument(node.id);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const canReveal = role === "owner" || role === "admin";

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-xl">{node.icon}</span>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
            {node.name}
          </h1>
          <p className="metric truncate text-[11px] text-faint-foreground">
            Encrypted at rest · every reveal is recorded
          </p>
        </div>

        <Badge variant={canReveal ? "success" : "default"} className="ml-2">
          {canReveal ? `${role} access` : `${role} — masked only`}
        </Badge>

        <Button
          size="sm"
          variant={isAuditOpen ? "subtle" : "ghost"}
          className="ml-auto gap-1.5"
          aria-pressed={isAuditOpen}
          onClick={() => setIsAuditOpen((open) => !open)}
        >
          <ShieldCheck />
          Audit log
        </Button>
      </header>

      {!canReveal && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
          <Lock className="size-3.5 shrink-0 text-faint-foreground" />
          <p className="text-[12px] text-muted-foreground">
            Only owners and admins can reveal or copy these values. Asking anyway is refused by the
            server and still recorded.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <AsyncBoundary
            state={controller.state}
            onRetry={controller.reload}
            loading={<ListLoadingState />}
          >
            {(document) => (
              <ul className="space-y-1.5">
                {document.entries.map((entry) => (
                  <SecretRow
                    key={entry.id}
                    entry={entry}
                    value={controller.revealed[entry.id]}
                    isBusy={controller.busyId === entry.id}
                    canReveal={canReveal}
                    canCopy={capabilities.view && canReveal}
                    onReveal={() => void controller.reveal(entry.id)}
                    onHide={() => controller.hide(entry.id)}
                    onCopy={() => void controller.copy(entry.id)}
                  />
                ))}
              </ul>
            )}
          </AsyncBoundary>
        </div>

        {isAuditOpen && <AuditPanel nodeId={node.id} />}
      </div>
    </div>
  );
}

interface SecretRowProps {
  readonly entry: SecretEntry;
  readonly value: string | undefined;
  readonly isBusy: boolean;
  readonly canReveal: boolean;
  readonly canCopy: boolean;
  readonly onReveal: () => void;
  readonly onHide: () => void;
  readonly onCopy: () => void;
}

function SecretRow({
  entry,
  value,
  isBusy,
  canReveal,
  canCopy,
  onReveal,
  onHide,
  onCopy,
}: SecretRowProps) {
  const isRevealed = value !== undefined;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="metric shrink-0 text-[12px] font-medium text-foreground">{entry.key}</span>
      <span className="metric shrink-0 text-[12px] text-faint-foreground">=</span>

      <span
        className={cn(
          "metric min-w-0 flex-1 truncate text-[12px]",
          isRevealed ? "text-foreground" : "tracking-widest text-faint-foreground",
        )}
      >
        {isRevealed ? value : entry.maskedValue}
      </span>

      <SelectChip option={environmentOption(entry.environmentOptionId)} />

      <span className="metric hidden shrink-0 items-center gap-1.5 text-[10px] text-faint-foreground sm:flex">
        <UserAvatar user={entry.rotatedBy} className="size-4" />
        {formatRelativeTime(entry.updatedAt)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={!canReveal || isBusy}
          aria-label={isRevealed ? `Hide ${entry.key}` : `Reveal ${entry.key}`}
          onClick={isRevealed ? onHide : onReveal}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : isRevealed ? <EyeOff /> : <Eye />}
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          disabled={!canCopy || isBusy}
          aria-label={`Copy ${entry.key}`}
          onClick={onCopy}
        >
          <Copy />
        </Button>
      </div>

      {entry.note && (
        <p className="w-full text-[11px] text-faint-foreground">{entry.note}</p>
      )}
    </li>
  );
}

function AuditPanel({ nodeId }: { nodeId: string }) {
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
        <ShieldCheck className="size-3.5 text-faint-foreground" />
        <h2 className="text-[12px] font-medium text-foreground">Audit log</h2>
        <span className="metric ml-auto text-[10px] text-faint-foreground">{entries.length}</span>
      </header>

      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-border bg-surface px-2.5 py-2">
            <div className="flex items-baseline gap-1.5">
              <Badge variant={entry.action === "reveal" ? "accent" : "default"}>
                {entry.action}
              </Badge>
              <span className="metric min-w-0 flex-1 truncate text-[11px] text-foreground">
                {entry.key}
              </span>
            </div>
            <p className="metric mt-1 truncate text-[10px] text-faint-foreground">
              {entry.actor.name} · {entry.ip} · {formatRelativeTime(entry.at)}
            </p>
          </li>
        ))}

        {entries.length === 0 && (
          <li className="px-1 py-6 text-center text-[11px] text-faint-foreground">
            Nothing has been revealed in this session.
          </li>
        )}
      </ol>
    </aside>
  );
}
