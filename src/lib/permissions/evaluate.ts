import { OWNER_ESCALATIONS, minimumRoleFor, roleHas, ROLE_LABELS } from "@/lib/permissions/roles";
import {
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

const READ_ONLY_KEYS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  "board.export",
  "workspace.audit.view",
  "secret.reveal",
]);

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
  readonly role: WorkspaceRole;
  readonly user: UserSummary;
  readonly node?: DriveNode | null;
  readonly isFrozen?: boolean;
  readonly isLocked?: boolean;
}

const isWrite = (key: PermissionKey): boolean => !READ_ONLY_KEYS.has(key);

export function can(key: PermissionKey, context: PermissionContext): boolean {
  const { role, user, node, isFrozen = false, isLocked = false } = context;

  const owns = Boolean(node) && node?.owner.id === user.id;
  const isEscalated =
    owns && OWNER_ESCALATIONS.has(key) && roleRank(role) >= roleRank("member");

  if (!roleHas(role, key) && !isEscalated) return false;
  if (!isWrite(key)) return true;

  if (node?.isTrashed) return key === "node.delete";

  if (isFrozen) return false;
  if (isLocked && CONTENT_WRITE_KEYS.has(key)) return false;

  return true;
}

export function resolverFor(context: PermissionContext): PermissionResolver {
  return (key: PermissionKey) => can(key, context);
}

export function frozenResolver(resolve: PermissionResolver): PermissionResolver {
  return (key: PermissionKey) => (isWrite(key) ? false : resolve(key));
}

function editKeyFor(node: DriveNode | null | undefined): PermissionKey {
  if (!node) return "row.update";
  if (isDocument(node)) return "document.update";
  if (isFile(node)) return "file.update";
  if (isBoard(node)) return "row.update";
  return "node.rename";
}

export function capabilitiesFor(context: PermissionContext): CapabilitySet {
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

export function documentCapabilities(
  base: CapabilitySet,
  document: Pick<WorkspaceDocument, "isLocked" | "isArchived">,
): CapabilitySet {
  if (!document.isLocked && !document.isArchived) return base;
  return { ...base, edit: false, upload: false };
}

export function canToggleLock(
  resolve: PermissionResolver,
  document: Pick<WorkspaceDocument, "owner">,
  user: UserSummary,
): boolean {
  return resolve("document.lock") || document.owner.id === user.id;
}

export const DENIED_REASON =
  "You do not have access to this item. Ask somebody who does to share it with you.";

export function deniedReason(): string {
  return DENIED_REASON;
}

export function requirementFor(key: PermissionKey): string {
  const role = minimumRoleFor(key);
  return role ? `Needs the ${ROLE_LABELS[role]} role or above` : "Not available on this workspace";
}
