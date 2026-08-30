import type { PermissionModule } from "./permission";
import type { UserSummary } from "./user";

export type AuditSeverity = "info" | "warn" | "error";

export type AuditModule = PermissionModule | "system";

export type AuditOutcome = "allowed" | "denied";

export interface AuditEvent {
  readonly id: string;
  readonly at: string;
  readonly module: AuditModule;
  readonly action: string;
  readonly actor: UserSummary;
  readonly ip: string;
  readonly severity: AuditSeverity;
  readonly target: string | null;
  readonly detail: string | null;
  readonly outcome: AuditOutcome;
}

export interface AuditQuery {
  readonly module?: AuditModule | "all";
  readonly severity?: AuditSeverity | "all";
  readonly actorId?: string | "all";
  readonly search?: string;
  readonly limit?: number;
}

export interface AuditPage {
  readonly events: readonly AuditEvent[];
  readonly total: number;
  readonly bySeverity: Readonly<Record<AuditSeverity, number>>;
}
