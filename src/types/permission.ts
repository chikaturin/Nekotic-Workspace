
export type WorkspaceRole = "viewer" | "member" | "manager" | "admin";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  "viewer",
  "member",
  "manager",
  "admin",
] as const;

export function roleRank(role: WorkspaceRole): number {
  return WORKSPACE_ROLES.indexOf(role);
}

export const PERMISSION_KEYS = [
  "workspace.manage",
  "workspace.settings.view",
  "workspace.member.manage",
  "workspace.permission.manage",
  "workspace.audit.view",
  "workspace.delete",

  "node.create",
  "node.rename",
  "node.move",
  "node.delete",
  "node.share",
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
  "board.export",

  "row.create",
  "row.update",
  "row.move",
  "row.archive",
  "row.delete",

  "document.create",
  "document.update",
  "document.lock",
  "document.version.restore",

  "file.upload",
  "file.update",
  "file.delete",

  "comment.create",
  "comment.resolve",
  "comment.delete",

  "secret.reveal",
  "secret.rotate",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionSet = ReadonlySet<PermissionKey>;

export type PermissionResolver = (key: PermissionKey) => boolean;

export type PermissionModule =
  | "workspace"
  | "node"
  | "board"
  | "row"
  | "document"
  | "file"
  | "comment"
  | "secret";

export interface PermissionDefinition {
  readonly key: PermissionKey;
  readonly module: PermissionModule;
  readonly label: string;
  readonly summary: string;
}

export type Capability = "view" | "edit" | "upload" | "delete" | "share" | "manage";

export type CapabilitySet = Readonly<Record<Capability, boolean>>;

export const NO_CAPABILITIES: CapabilitySet = {
  view: false,
  edit: false,
  upload: false,
  delete: false,
  share: false,
  manage: false,
};

export type AccessSubject =
  | { readonly kind: "user"; readonly userId: string }
  | { readonly kind: "role"; readonly role: WorkspaceRole };

export interface AccessRule {
  readonly id: string;
  readonly nodeId: string;
  readonly subject: AccessSubject;
  readonly role: WorkspaceRole;
  readonly grantedAt: string;
  readonly grantedBy: string;
}

export type AccessSource = "workspace" | "inherited" | "explicit" | "override";

export interface AccessOrigin {
  readonly nodeId: string;
  readonly name: string;
}

export interface ResolvedAccess {
  readonly subject: AccessSubject;
  readonly role: WorkspaceRole;
  readonly source: AccessSource;
  readonly origin: AccessOrigin | null;
  readonly inheritedRole: WorkspaceRole | null;
  readonly inheritedFrom: AccessOrigin | null;
}
