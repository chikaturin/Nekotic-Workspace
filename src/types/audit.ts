import type { PermissionModule } from "./permission";
import type { UserSummary } from "./user";

/**
 * Audit log (SY-AUD-41).
 *
 * The record is append-only by construction: the service exposes `record` and
 * `list`, and nothing else. There is no update path and no delete path, so no
 * surface can offer one.
 */

export type AuditSeverity = "info" | "warn" | "error";

/**
 * Modules the log files events under. Everything the RBAC catalogue governs,
 * plus `system` for events no user initiated.
 */
export type AuditModule = PermissionModule | "system";

export type AuditOutcome = "allowed" | "denied";

export interface AuditEvent {
  readonly id: string;
  readonly at: string;
  readonly module: AuditModule;
  /**
   * What happened, as a catalogue key where one exists (`secret.reveal`) so a
   * row can be traced back to the permission that governs it.
   */
  readonly action: string;
  readonly actor: UserSummary;
  /** Address the call came from. Recorded by the backend, never derived here. */
  readonly ip: string;
  readonly severity: AuditSeverity;
  /** Human label of the thing acted on — never an id, never a payload. */
  readonly target: string | null;
  /** One sentence. The UI never renders a raw audit payload (SY-ACT-40). */
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
  /** Matches before the limit was applied, so the table can say "of N". */
  readonly total: number;
  readonly bySeverity: Readonly<Record<AuditSeverity, number>>;
}
