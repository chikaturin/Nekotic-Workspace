import { WORKSPACE_ROLES, type PermissionKey, type PermissionSet, type WorkspaceRole } from "@/types";

const VIEWER: readonly PermissionKey[] = [];

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
  "board.export",
];

const MANAGER: readonly PermissionKey[] = [
  "node.create",
  "node.rename",
  "node.move",
  "node.delete",
  "node.archive",
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

export function roleHas(role: WorkspaceRole, key: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].has(key);
}

export function minimumRoleFor(key: PermissionKey): WorkspaceRole | null {
  return WORKSPACE_ROLES.find((role) => roleHas(role, key)) ?? null;
}
