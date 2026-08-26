import { OWNER_ESCALATIONS, minimumRoleFor, roleHas, ROLE_LABELS } from "@/lib/permissions/roles";
import {
  NO_CAPABILITIES,
  isBoard,
  isDocument,
  isFile,
  roleRank,
  type CapabilitySet,
  type DriveNode,
  type PermissionKey,
  type PermissionResolver,
  type UserSummary,
  type WorkspaceDocument,
  type WorkspaceRole,
} from "@/types";

/**
 * Deciding one permission (SY-RBC-42).
 *
 * `can` is the only function that answers "may I". Components call it with a
 * key; they never look at a role, and they never re-derive a rule. Every layer
 * below the role matrix can only *narrow* the answer — a lock, an archive or a
 * trashed parent takes permissions away, it never hands one out.
 *
 * None of this is security. It decides what the UI offers; the backend decides
 * what actually happens, and must re-check every one of these keys.
 */

/** Keys that read rather than write. A frozen or locked node still allows them. */
const READ_ONLY_KEYS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  "board.export",
  "workspace.audit.view",
  "secret.reveal",
]);

/** Writes that put *content* into a node, which is what a lock stops. */
const CONTENT_WRITE_KEYS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  "row.create",
  "row.update",
  "row.move",
  "row.delete",
  "document.update",
  "document.version.restore",
  "file.update",
  "file.upload",
  "board.import",
  "board.column.create",
  "board.column.update",
  "board.column.delete",
]);

export interface PermissionContext {
  /** Effective role on this node, already resolved through inheritance. */
  readonly role: WorkspaceRole;
  readonly user: UserSummary;
  /** Node being acted on; omit for workspace-level checks. */
  readonly node?: DriveNode | null;
  /**
   * An archived *ancestor* holds this node frozen. The node's own archive flag
   * is deliberately not read here: a surface must keep offering Restore on the
   * thing you are standing on.
   */
  readonly isFrozen?: boolean;
  /** Document lock — stops content writes, never the unlock itself. */
  readonly isLocked?: boolean;
}

const isWrite = (key: PermissionKey): boolean => !READ_ONLY_KEYS.has(key);

/** A restricted node is invisible to everyone but its owner, whatever the role. */
function isBlocked(context: PermissionContext): boolean {
  const { node, user } = context;
  return Boolean(node?.isRestricted) && node?.owner.id !== user.id;
}

export function can(key: PermissionKey, context: PermissionContext): boolean {
  if (isBlocked(context)) return false;

  const { role, user, node, isFrozen = false, isLocked = false } = context;

  const owns = Boolean(node) && node?.owner.id === user.id;
  const isEscalated =
    owns && OWNER_ESCALATIONS.has(key) && roleRank(role) >= roleRank("member");

  if (!roleHas(role, key) && !isEscalated) return false;
  if (!isWrite(key)) return true;

  // A trashed node accepts nothing but the calls that get it out of the bin
  // again, or end it for good.
  if (node?.isTrashed) return key === "node.delete";

  if (isFrozen) return false;
  if (isLocked && CONTENT_WRITE_KEYS.has(key)) return false;

  return true;
}

/** Bind a context once and hand components the question, not the answer. */
export function resolverFor(context: PermissionContext): PermissionResolver {
  return (key: PermissionKey) => can(key, context);
}

/**
 * Close every write on an existing resolver, for the surface of a node that is
 * archived in its own right. Reads — export above all — stay open, and so does
 * the Restore the surface still has to offer.
 */
export function frozenResolver(resolve: PermissionResolver): PermissionResolver {
  return (key: PermissionKey) => (isWrite(key) ? false : resolve(key));
}

/**
 * Which key the coarse `edit` flag means for this node. Editing a board is
 * editing its records; editing a page is writing blocks — the same word, two
 * different permissions, and the projection keeps them apart.
 */
function editKeyFor(node: DriveNode | null | undefined): PermissionKey {
  if (!node) return "row.update";
  if (isDocument(node)) return "document.update";
  if (isFile(node)) return "file.update";
  if (isBoard(node)) return "row.update";
  return "node.rename";
}

/**
 * The coarse flags older surfaces branch on, derived from the catalogue rather
 * than declared beside it — so `capabilities.edit` and `can("row.update")` can
 * never disagree.
 */
export function capabilitiesFor(context: PermissionContext): CapabilitySet {
  if (isBlocked(context)) return NO_CAPABILITIES;

  const resolve = resolverFor(context);

  return {
    view: true,
    edit: resolve(editKeyFor(context.node)),
    upload: resolve("file.upload"),
    delete: resolve("node.delete"),
    share: resolve("node.share"),
    manage: resolve("node.archive"),
  };
}

/** Locking and archiving narrow an existing capability set — never widen it. */
export function documentCapabilities(
  base: CapabilitySet,
  document: Pick<WorkspaceDocument, "isLocked" | "isArchived">,
): CapabilitySet {
  if (!document.isLocked && !document.isArchived) return base;
  return { ...base, edit: false, upload: false };
}

/**
 * Who may take the lock off again: whoever holds the key, and the document's
 * owner. It lives here rather than in the page so the rule stays in one place.
 */
export function canToggleLock(
  resolve: PermissionResolver,
  document: Pick<WorkspaceDocument, "owner">,
  user: UserSummary,
): boolean {
  return resolve("document.lock") || document.owner.id === user.id;
}

/** Reason shown on the permission-denied screen. */
export function deniedReason(node: DriveNode | null): string {
  if (node?.isRestricted) {
    return `“${node.name}” is restricted to a group you are not part of. Ask a workspace admin for access.`;
  }
  return "You do not have permission to view this content.";
}

/**
 * Why an action is unavailable, for a tooltip on the control that is off.
 * Names the role that would hold it — never the raw key.
 */
export function requirementFor(key: PermissionKey): string {
  const role = minimumRoleFor(key);
  return role ? `Needs the ${ROLE_LABELS[role]} role or above` : "Not available on this workspace";
}
