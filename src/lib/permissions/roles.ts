import { WORKSPACE_ROLES, type PermissionKey, type PermissionSet, type WorkspaceRole } from "@/types";

/**
 * The role matrix (SY-RBC-42).
 *
 * Each role is the one below it plus what it adds, so a permission can never
 * be granted to Member and withheld from Manager by accident. This table is
 * the only place a role is turned into permissions.
 */

/**
 * Viewer holds no action keys at all. "Read only" is exactly that: being able
 * to see a node is decided by access resolution, not by an action — so the
 * viewer column of the matrix is empty by construction rather than by omission.
 */
const VIEWER: readonly PermissionKey[] = [];

/**
 * Member: the record-level worker. Edits cells, adds records, drags them
 * across a Kanban, comments and uploads — and touches no structure.
 */
const MEMBER: readonly PermissionKey[] = [
  "row.create",
  "row.update",
  "row.move",
  "comment.create",
  "comment.resolve",
  "comment.delete",
  "file.upload",
  "file.update",
  "node.share",
  // Taking data out of the product is a step past reading it, so it starts
  // here rather than at Viewer.
  "board.export",
];

/** Manager: everything structural inside the workspace, but not the workspace. */
const MANAGER: readonly PermissionKey[] = [
  "node.create",
  "node.rename",
  "node.move",
  "node.delete",
  "node.archive",
  // Restricting a folder is structural, not administrative: a project lead
  // shuts their own folder without waiting on a workspace admin. It only ever
  // applies to a folder they can already see, so it hands out nothing.
  "node.access.manage",
  "board.create",
  "board.manage",
  "board.column.create",
  "board.column.update",
  "board.column.delete",
  "board.view.manage",
  "board.template.manage",
  "board.import",
  "row.archive",
  "row.delete",
  "document.create",
  "document.update",
  "document.lock",
  "document.version.restore",
  "file.delete",
];

/** Admin: the workspace itself, its people, its audit trail and its secrets. */
const ADMIN: readonly PermissionKey[] = [
  "workspace.manage",
  "workspace.settings.view",
  "workspace.member.manage",
  "workspace.permission.manage",
  "workspace.audit.view",
  "workspace.delete",
  "secret.reveal",
  "secret.rotate",
];

const ADDITIONS: Readonly<Record<WorkspaceRole, readonly PermissionKey[]>> = {
  viewer: VIEWER,
  member: MEMBER,
  manager: MANAGER,
  admin: ADMIN,
};

function accumulate(): Readonly<Record<WorkspaceRole, PermissionSet>> {
  const result: Partial<Record<WorkspaceRole, PermissionSet>> = {};
  const carried = new Set<PermissionKey>();

  for (const role of WORKSPACE_ROLES) {
    for (const key of ADDITIONS[role]) carried.add(key);
    result[role] = new Set(carried);
  }

  return result as Record<WorkspaceRole, PermissionSet>;
}

export const ROLE_PERMISSIONS = accumulate();

/**
 * Actions a node's owner keeps even below the role that normally grants them.
 * Ownership is not a role — it escalates these few keys on your own things.
 */
export const OWNER_ESCALATIONS: PermissionSet = new Set<PermissionKey>([
  "node.rename",
  "node.delete",
  "node.archive",
  "file.delete",
  "document.lock",
]);

export const ROLE_LABELS: Readonly<Record<WorkspaceRole, string>> = {
  viewer: "Viewer",
  member: "Member",
  manager: "Manager",
  admin: "Admin",
};

export const ROLE_SUMMARIES: Readonly<Record<WorkspaceRole, string>> = {
  viewer: "Reads everything they are given access to. Changes nothing.",
  member: "Works inside boards: cells, records, comments, uploads.",
  manager: "Everything a member does, plus the structure it lives in.",
  admin: "The workspace itself — people, access, audit and secrets.",
};

/** True when `role` holds `key` from the matrix alone, before any node rules. */
export function roleHas(role: WorkspaceRole, key: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].has(key);
}

/** The weakest role that holds `key`, for "needs Manager or above" messages. */
export function minimumRoleFor(key: PermissionKey): WorkspaceRole | null {
  return WORKSPACE_ROLES.find((role) => roleHas(role, key)) ?? null;
}
