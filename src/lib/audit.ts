import { MODULE_LABELS, PERMISSION_BY_KEY, permissionLabel } from "@/lib/permissions/catalog";
import { formatClockTime, formatDate } from "@/lib/format";
import type { AuditEvent, AuditModule, AuditSeverity, PermissionKey } from "@/types";

/**
 * Reading the audit log (SY-AUD-41).
 *
 * Everything here turns a stored event into text. There is no mutation helper
 * in this file, and none in the service either — the log is append-only, so
 * the UI has nothing to offer but reading it.
 */

export const AUDIT_MODULE_LABELS: Readonly<Record<AuditModule, string>> = {
  ...MODULE_LABELS,
  system: "System",
};

export const AUDIT_MODULES: readonly AuditModule[] = [
  "workspace",
  "node",
  "board",
  "row",
  "document",
  "file",
  "comment",
  "secret",
  "system",
];

export const SEVERITY_LABELS: Readonly<Record<AuditSeverity, string>> = {
  info: "Info",
  warn: "Warn",
  error: "Error",
};

export const SEVERITIES: readonly AuditSeverity[] = ["info", "warn", "error"];

/**
 * An action is written as a permission key wherever one governs it, so the
 * row can be read back against the matrix. Anything else is humanised.
 */
export function auditActionLabel(action: string): string {
  if (PERMISSION_BY_KEY.has(action as PermissionKey)) {
    return permissionLabel(action as PermissionKey);
  }

  const tail = action.slice(action.indexOf(".") + 1).replace(/[._]/g, " ");
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

/** `26 Aug 2026 · 16:20` — absolute, because an audit row is evidence. */
export function auditTimestamp(iso: string): string {
  return `${formatDate(iso)} · ${formatClockTime(iso)}`;
}

/**
 * One sentence describing the row, for the screen-reader label. It reads the
 * stored fields — it never stringifies the event.
 */
export function describeAuditEvent(event: AuditEvent): string {
  const outcome = event.outcome === "denied" ? "was denied" : "succeeded";
  const target = event.target ? ` on ${event.target}` : "";
  return `${event.actor.name}: ${auditActionLabel(event.action)}${target} ${outcome}`;
}

/** Whether a row matches a free-text filter, across the columns on screen. */
export function matchesSearch(event: AuditEvent, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) return true;

  return [
    event.actor.name,
    event.action,
    auditActionLabel(event.action),
    event.target ?? "",
    event.detail ?? "",
    event.ip,
  ].some((field) => field.toLowerCase().includes(needle));
}
