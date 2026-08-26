import { AUDIT_PAGE_SIZE, MOCK_NOW } from "@/config/app";
import { matchesSearch } from "@/lib/audit";
import { DIRECTORY, TEAM } from "@/mock/users";
import { assertNoSimulatedListFailure, isSimulatedEmpty, nextId, nowIso, readDelay } from "@/services/backend";
import type {
  AuditEvent,
  AuditModule,
  AuditPage,
  AuditQuery,
  AuditSeverity,
  UserSummary,
} from "@/types";

/**
 * Audit log (SY-AUD-41).
 *
 * The surface is two calls: `record` appends, `list` reads. There is no
 * update and no delete — not disabled in the UI, absent from the service — so
 * no screen can grow an Edit button that quietly works.
 */

const MINUTE = 60_000;

/** Deterministic clock for the seed, so SSR and the client agree. */
function before(minutes: number): string {
  return new Date(Date.parse(MOCK_NOW) - minutes * MINUTE).toISOString();
}

const actor = (id: string): UserSummary =>
  DIRECTORY.find((person) => person.id === id) ?? TEAM[0]!;

interface SeedSpec {
  readonly minutesAgo: number;
  readonly module: AuditModule;
  readonly action: string;
  readonly actorId: string;
  readonly ip: string;
  readonly severity: AuditSeverity;
  readonly target?: string | null;
  readonly detail?: string;
  readonly outcome?: "allowed" | "denied";
}

const SEED: readonly SeedSpec[] = [
  {
    minutesAgo: 6,
    module: "secret",
    action: "secret.reveal",
    actorId: "usr_khanh",
    ip: "10.4.19.22",
    severity: "warn",
    target: "STRIPE_SECRET_KEY",
    detail: "Revealed once and cleared after 30 seconds.",
  },
  {
    minutesAgo: 11,
    module: "secret",
    action: "secret.reveal",
    actorId: "usr_hai",
    ip: "10.4.31.87",
    severity: "error",
    target: "STRIPE_SECRET_KEY",
    detail: "Refused: the Viewer role does not hold Reveal secrets.",
    outcome: "denied",
  },
  {
    minutesAgo: 24,
    module: "workspace",
    action: "workspace.permission.manage",
    actorId: "usr_khanh",
    ip: "10.4.19.22",
    severity: "warn",
    target: "Backend",
    detail: "Duc Pham set to Member on this folder, overriding Manager.",
  },
  {
    minutesAgo: 38,
    module: "row",
    action: "row.delete",
    actorId: "usr_mai",
    ip: "10.4.22.5",
    severity: "warn",
    target: "Backend Roadmap",
    detail: "12 records deleted in one action.",
  },
  {
    minutesAgo: 52,
    module: "board",
    action: "board.import",
    actorId: "usr_mai",
    ip: "10.4.22.5",
    severity: "info",
    target: "Backend Roadmap",
    detail: "48 records imported from sprint-backlog.xlsx, 3 rows left out.",
  },
  {
    minutesAgo: 64,
    module: "node",
    action: "node.archive",
    actorId: "usr_mai",
    ip: "10.4.22.5",
    severity: "info",
    target: "Q3 Launch Brief",
    detail: "Archived out of the active workspace.",
  },
  {
    minutesAgo: 71,
    module: "file",
    action: "file.upload",
    actorId: "usr_duc",
    ip: "10.4.27.140",
    severity: "error",
    target: "release-build.zip",
    detail: "Upload failed after 3 attempts: the connection dropped.",
  },
  {
    minutesAgo: 88,
    module: "document",
    action: "document.lock",
    actorId: "usr_khanh",
    ip: "10.4.19.22",
    severity: "info",
    target: "Payment Service Config",
    detail: "Locked for editing while the release is cut.",
  },
  {
    minutesAgo: 96,
    module: "node",
    action: "node.delete",
    actorId: "usr_lan",
    ip: "10.4.30.11",
    severity: "warn",
    target: "Payment",
    detail: "Moved to Trash with 2 items under it.",
  },
  {
    minutesAgo: 120,
    module: "workspace",
    action: "workspace.member.manage",
    actorId: "usr_khanh",
    ip: "10.4.19.22",
    severity: "warn",
    target: "Hai Vo",
    detail: "Role changed from Member to Viewer.",
  },
  {
    minutesAgo: 134,
    module: "board",
    action: "board.column.delete",
    actorId: "usr_mai",
    ip: "10.4.22.5",
    severity: "warn",
    target: "Frontend Sprint",
    detail: "Column “Story points” removed with its values.",
  },
  {
    minutesAgo: 150,
    module: "row",
    action: "row.update",
    actorId: "usr_duc",
    ip: "10.4.27.140",
    severity: "info",
    target: "TASK-118",
    detail: "Status moved to In review.",
  },
  {
    minutesAgo: 168,
    module: "comment",
    action: "comment.delete",
    actorId: "usr_lan",
    ip: "10.4.30.11",
    severity: "info",
    target: "BUG-42",
    detail: "Removed a reply on a resolved thread.",
  },
  {
    minutesAgo: 192,
    module: "document",
    action: "document.update",
    actorId: "usr_hai",
    ip: "10.4.31.87",
    severity: "error",
    target: "Release Checklist",
    detail: "Refused: the page is locked.",
    outcome: "denied",
  },
  {
    minutesAgo: 205,
    module: "system",
    action: "system.retention.sweep",
    actorId: "usr_khanh",
    ip: "127.0.0.1",
    severity: "info",
    target: "Trash",
    detail: "4 items past the 30-day window were purged.",
  },
  {
    minutesAgo: 240,
    module: "board",
    action: "board.export",
    actorId: "usr_duc",
    ip: "10.4.27.140",
    severity: "info",
    target: "Backend Roadmap",
    detail: "31 records exported to XLSX. 1 sensitive column omitted.",
  },
  {
    minutesAgo: 288,
    module: "secret",
    action: "secret.rotate",
    actorId: "usr_khanh",
    ip: "10.4.19.22",
    severity: "warn",
    target: "DATABASE_URL",
    detail: "Rotated. The previous value is no longer readable.",
  },
  {
    minutesAgo: 330,
    module: "node",
    action: "node.share",
    actorId: "usr_mai",
    ip: "10.4.22.5",
    severity: "info",
    target: "Design System",
    detail: "Link created for the workspace, view only.",
  },
  {
    minutesAgo: 400,
    module: "workspace",
    action: "workspace.audit.view",
    actorId: "usr_hai",
    ip: "10.4.31.87",
    severity: "error",
    target: "Audit log",
    detail: "Refused: the Viewer role does not hold Read the audit log.",
    outcome: "denied",
  },
  {
    minutesAgo: 480,
    module: "system",
    action: "system.session.start",
    actorId: "usr_khanh",
    ip: "10.4.19.22",
    severity: "info",
    target: null,
    detail: "Signed in from a new device.",
  },
];

function seed(): AuditEvent[] {
  return SEED.map((spec, index) => ({
    id: `aud_seed_${index}`,
    at: before(spec.minutesAgo),
    module: spec.module,
    action: spec.action,
    actor: actor(spec.actorId),
    ip: spec.ip,
    severity: spec.severity,
    target: spec.target ?? null,
    detail: spec.detail ?? null,
    outcome: spec.outcome ?? "allowed",
  }));
}

/** Newest first. The log only ever grows at the head. */
let events: AuditEvent[] = seed();

export interface AuditInput {
  readonly module: AuditModule;
  readonly action: string;
  readonly actor: UserSummary;
  readonly severity?: AuditSeverity;
  readonly target?: string | null;
  readonly detail?: string | null;
  readonly outcome?: "allowed" | "denied";
  /** Address of the caller. The backend stamps this; the client never guesses. */
  readonly ip?: string;
}

/**
 * Address the mock backend attributes a call to. A real backend reads it off
 * the socket — the client must never send one, which is why this lives here
 * and not in any hook.
 */
const LOCAL_IP = "10.4.19.22";

/** Append one event. Nothing in this module can change or remove it again. */
function record(input: AuditInput): AuditEvent {
  const event: AuditEvent = {
    id: nextId("aud"),
    at: nowIso(),
    module: input.module,
    action: input.action,
    actor: input.actor,
    ip: input.ip ?? LOCAL_IP,
    severity: input.severity ?? (input.outcome === "denied" ? "error" : "info"),
    target: input.target ?? null,
    detail: input.detail ?? null,
    outcome: input.outcome ?? "allowed",
  };

  events = [event, ...events];
  return event;
}

function matches(event: AuditEvent, query: AuditQuery): boolean {
  if (query.module && query.module !== "all" && event.module !== query.module) return false;
  if (query.severity && query.severity !== "all" && event.severity !== query.severity) return false;
  if (query.actorId && query.actorId !== "all" && event.actor.id !== query.actorId) return false;
  return matchesSearch(event, query.search ?? "");
}

async function list(query: AuditQuery = {}, signal?: AbortSignal): Promise<AuditPage> {
  await readDelay(signal);
  assertNoSimulatedListFailure("the audit log");

  const source = isSimulatedEmpty() ? [] : events;
  const matched = source.filter((event) => matches(event, query));

  const bySeverity: Record<AuditSeverity, number> = { info: 0, warn: 0, error: 0 };
  for (const event of matched) bySeverity[event.severity] += 1;

  return {
    events: matched.slice(0, query.limit ?? AUDIT_PAGE_SIZE),
    total: matched.length,
    bySeverity,
  };
}

/** Test hook: drop runtime events and go back to the seeded trail. */
function reset(): void {
  events = seed();
}

export const auditService = { record, list, reset };
