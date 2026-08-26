"use client";

import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { AUDIT_MODULE_LABELS, SEVERITY_LABELS, auditActionLabel, auditTimestamp, describeAuditEvent } from "@/lib/audit";
import { cn } from "@/lib/utils";
import type { AuditEvent, AuditSeverity } from "@/types";

const SEVERITY_ICONS: Readonly<Record<AuditSeverity, LucideIcon>> = {
  info: Info,
  warn: TriangleAlert,
  error: CircleAlert,
};

const SEVERITY_CLASSES: Readonly<Record<AuditSeverity, string>> = {
  info: "border-border bg-surface text-muted-foreground",
  warn: "border-warning/30 bg-warning/10 text-warning",
  error: "border-danger/30 bg-danger/10 text-danger",
};

/**
 * The trail itself (SY-AUD-41).
 *
 * Six columns and no seventh: there is no actions column, because a record of
 * what happened that someone can tidy up is not a record. The detail line is a
 * sentence the service wrote — never a payload rendered as JSON.
 */
export function AuditTable({ events }: { events: readonly AuditEvent[] }) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <caption className="sr-only">
        Workspace audit log. Read-only: entries cannot be edited or deleted.
      </caption>

      <thead className="sticky top-0 z-10 bg-elevated">
        <tr className="border-b border-border text-left text-muted-foreground">
          <th scope="col" className="px-3 py-2 font-medium">Timestamp</th>
          <th scope="col" className="px-3 py-2 font-medium">Module</th>
          <th scope="col" className="px-3 py-2 font-medium">Action</th>
          <th scope="col" className="px-3 py-2 font-medium">Actor</th>
          <th scope="col" className="px-3 py-2 font-medium">IP</th>
          <th scope="col" className="px-3 py-2 font-medium">Severity</th>
        </tr>
      </thead>

      <tbody>
        {events.map((event) => {
          const Icon = SEVERITY_ICONS[event.severity];

          return (
            <tr key={event.id} className="border-b border-hairline align-top last:border-0 hover:bg-hover">
              <td className="metric whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                {auditTimestamp(event.at)}
              </td>

              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {AUDIT_MODULE_LABELS[event.module]}
              </td>

              <td className="px-3 py-2">
                <p className="text-foreground">
                  {auditActionLabel(event.action)}
                  {event.target && (
                    <span className="text-muted-foreground"> · {event.target}</span>
                  )}
                  {event.outcome === "denied" && (
                    <Badge variant="danger" className="ml-1.5">
                      denied
                    </Badge>
                  )}
                </p>
                {event.detail && (
                  <p className="mt-0.5 max-w-lg text-[11px] text-faint-foreground">{event.detail}</p>
                )}
                <span className="sr-only">{describeAuditEvent(event)}</span>
              </td>

              <td className="whitespace-nowrap px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <UserAvatar user={event.actor} className="size-5" />
                  <span className="text-foreground">{event.actor.name}</span>
                </span>
              </td>

              <td className="metric whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                {event.ip}
              </td>

              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wider",
                    SEVERITY_CLASSES[event.severity],
                  )}
                >
                  <Icon className="size-3" aria-hidden />
                  {SEVERITY_LABELS[event.severity]}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
