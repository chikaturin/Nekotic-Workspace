"use client";

import { FileSearch, Lock, ScrollText } from "lucide-react";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditTable } from "@/components/audit/audit-table";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ListLoadingState, PermissionDeniedState, StatePanel } from "@/components/shared/state-panels";
import { Badge } from "@/components/ui/badge";
import { useAuditLog } from "@/hooks/use-audit-log";
import { SEVERITY_LABELS } from "@/lib/audit";
import { formatCount } from "@/lib/format";
import { permissionDenied, toAppError } from "@/services/errors";
import type { AuditSeverity } from "@/types";

const TONES: Readonly<Record<AuditSeverity, "default" | "danger">> = {
  info: "default",
  warn: "default",
  error: "danger",
};

/**
 * Audit log (SY-AUD-41).
 *
 * Read-only, and read-only by construction rather than by discipline: the
 * service has no update or delete call, so there is nothing for this page to
 * offer even if someone added a button.
 */
export function AuditPage() {
  const { resource, filters, setFilter, clearFilters, isFiltered, canView } = useAuditLog();

  if (!canView) {
    return (
      <PermissionDeniedState
        error={toAppError(
          permissionDenied(
            "The audit log is open to workspace admins",
            "Your role does not hold “Read the audit log”. Ask an admin if you need it.",
          ),
        )}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <ScrollText className="size-4 text-accent" />
        </span>

        <div className="min-w-0">
          <h1 className="text-title font-semibold tracking-tight text-foreground">Audit log</h1>
          <p className="metric truncate text-body text-faint-foreground">
            Every privileged action, as it happened
          </p>
        </div>

        {/* Stated where someone would look for an Edit button. */}
        <span className="ml-auto flex items-center gap-1.5 text-body text-muted-foreground">
          <Lock className="size-3" />
          Append-only · entries cannot be edited or deleted
        </span>
      </header>

      <AuditFilters
        filters={filters}
        isFiltered={isFiltered}
        onChange={setFilter}
        onClear={clearFilters}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-canvas">
        <AsyncBoundary
          state={resource.state}
          onRetry={resource.reload}
          loading={<ListLoadingState rows={8} />}
          isEmpty={(page) => page.events.length === 0}
          empty={
            <StatePanel
              icon={FileSearch}
              title={isFiltered ? "No entries match those filters" : "Nothing has been recorded yet"}
              description={
                isFiltered
                  ? "Widen the range — the trail itself is never trimmed."
                  : "Privileged actions appear here the moment they happen."
              }
              {...(isFiltered ? { action: { label: "Clear filters", onClick: clearFilters } } : {})}
            />
          }
        >
          {(page) => (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-body text-muted-foreground">
                <span>{formatCount(page.total, "entry", "entries")}</span>
                {(Object.keys(page.bySeverity) as AuditSeverity[])
                  .filter((severity) => page.bySeverity[severity] > 0)
                  .map((severity) => (
                    <Badge key={severity} variant={TONES[severity]}>
                      {page.bySeverity[severity]} {SEVERITY_LABELS[severity]}
                    </Badge>
                  ))}
                {page.events.length < page.total && (
                  <span className="ml-auto">
                    Showing the {page.events.length} most recent
                  </span>
                )}
              </div>

              <AuditTable events={page.events} />
            </>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}
