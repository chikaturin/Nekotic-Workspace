/* ------------------------------------------------------------------- roles */

/**
 * The four workspace roles (SY-RBC-42), ordered from least to most capable.
 * Ownership of a node is a separate axis — it escalates a few actions on the
 * things you made, it is not a role.
 */
export type WorkspaceRole = "viewer" | "member" | "manager" | "admin";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  "viewer",
  "member",
  "manager",
  "admin",
] as const;

/** Rank, used to compare two grants — never to derive what a role may do. */
export function roleRank(role: WorkspaceRole): number {
  return WORKSPACE_ROLES.indexOf(role);
}

/* ------------------------------------------------------------ permissions */

/**
 * Every action the UI gates on, as a flat catalogue.
 *
 * Components ask `can("board.column.create")`. They never test the role: a
 * role check scattered through a component is a rule the catalogue does not
 * know about, and the next role added silently misses it.
 */
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

/** Answers one question about one subject. Handed to components as `can`. */
export type PermissionResolver = (key: PermissionKey) => boolean;

/**
 * First segment of every key. Modules are derived from the key rather than
 * declared beside it, so a new key can never be filed under the wrong one.
 */
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
  /** Imperative label for the matrix row: "Create columns". */
  readonly label: string;
  readonly summary: string;
}

/* ------------------------------------------------------------ capabilities */

/**
 * Coarse flags the surfaces have always branched on. They are a *projection*
 * of the catalogue above — `capabilitiesFor` derives them from `can`, so the
 * two can never drift apart.
 */
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

/* ------------------------------------------------------------ inheritance */

/** Who a rule is about. Roles cover everyone holding them; users are exact. */
export type AccessSubject =
  | { readonly kind: "user"; readonly userId: string }
  | { readonly kind: "role"; readonly role: WorkspaceRole };

/** An access rule written directly onto one node (SY-INH-43). */
export interface AccessRule {
  readonly id: string;
  readonly nodeId: string;
  readonly subject: AccessSubject;
  readonly role: WorkspaceRole;
  readonly grantedAt: string;
  readonly grantedBy: string;
}

/**
 * Where a subject's access on the node under inspection came from.
 *
 * `inherited` — nothing is written here; it flows down from an ancestor.
 * `explicit`  — written here, and it agrees with what would have flowed down.
 * `override`  — written here, and it *replaces* what would have flowed down.
 */
export type AccessSource = "workspace" | "inherited" | "explicit" | "override";

export interface AccessOrigin {
  readonly nodeId: string;
  readonly name: string;
}

/** One row of the access list: subject, effective role, and why. */
export interface ResolvedAccess {
  readonly subject: AccessSubject;
  readonly role: WorkspaceRole;
  readonly source: AccessSource;
  /** Node the rule is written on — null when it is the workspace default. */
  readonly origin: AccessOrigin | null;
  /** What the subject would have had with no rule here. Null when nothing. */
  readonly inheritedRole: WorkspaceRole | null;
  /** Ancestor the inherited value came from, for "Inherited from Backend". */
  readonly inheritedFrom: AccessOrigin | null;
}
