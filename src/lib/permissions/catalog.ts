import {
  PERMISSION_KEYS,
  type PermissionDefinition,
  type PermissionKey,
  type PermissionModule,
} from "@/types";

/**
 * The permission catalogue (SY-RBC-42).
 *
 * One entry per key, and the module is *derived from the key* rather than
 * declared beside it — a key can therefore never be filed under a module it
 * does not belong to.
 */

const LABELS: Readonly<Record<PermissionKey, readonly [string, string]>> = {
  "workspace.manage": ["Manage workspace", "Rename the workspace, change its plan and settings"],
  "workspace.member.manage": ["Manage members", "Invite people and change what role they hold"],
  "workspace.permission.manage": ["Manage access", "Write and remove access rules on any node"],
  "workspace.audit.view": ["Read the audit log", "Open the workspace audit trail"],

  "node.create": ["Create folders", "Add projects and folders to the drive"],
  "node.rename": ["Rename items", "Change the name of a folder, board, page or file"],
  "node.move": ["Move items", "Drag items to another place in the tree"],
  "node.delete": ["Delete items", "Send items to Trash"],
  "node.share": ["Share items", "Create links and invite people to one item"],
  "node.archive": ["Archive items", "Freeze an item and everything under it"],

  "board.create": ["Create boards", "Add a board from a template"],
  "board.manage": ["Manage boards", "Rename a board and change its settings"],
  "board.column.create": ["Create columns", "Add a column to a board"],
  "board.column.update": ["Edit columns", "Rename, resize, hide and convert columns"],
  "board.column.delete": ["Delete columns", "Remove a column and its values"],
  "board.view.manage": ["Manage saved views", "Create, rename, retype and delete a shared view"],
  "board.template.manage": ["Manage templates", "Save a board as a template and apply one"],
  "board.import": ["Import records", "Load records into a board from a file"],
  "board.export": ["Export records", "Download a board as XLSX, CSV or PDF"],

  "row.create": ["Add records", "Create a record on a board"],
  "row.update": ["Edit cells", "Change the value in a record's cell"],
  "row.move": ["Move records", "Drag a record between Kanban columns and dates"],
  "row.archive": ["Archive records", "Freeze records out of every view"],
  "row.delete": ["Delete records", "Remove records from a board"],

  "document.create": ["Create pages", "Add a page, config or secret document"],
  "document.update": ["Edit pages", "Write in a page and change its blocks"],
  "document.lock": ["Lock pages", "Take a page out of edit mode for everyone"],
  "document.version.restore": ["Restore versions", "Write an earlier version back over a page"],

  "file.upload": ["Upload files", "Add files to a folder or a record"],
  "file.update": ["Edit files", "Change the contents of a text or sheet file"],
  "file.delete": ["Delete files", "Send a file to Trash"],

  "comment.create": ["Comment", "Post comments and replies, and mention people"],
  "comment.resolve": ["Resolve threads", "Close a comment thread"],
  "comment.delete": ["Delete comments", "Remove a comment from a thread"],

  "secret.reveal": ["Reveal secrets", "Read a secret value in plaintext, once, audited"],
  "secret.rotate": ["Rotate secrets", "Replace a secret value with a new one"],
};

/** First segment of the key — `board.column.create` lives under `board`. */
export function moduleOf(key: PermissionKey): PermissionModule {
  return key.slice(0, key.indexOf(".")) as PermissionModule;
}

export const PERMISSIONS: readonly PermissionDefinition[] = PERMISSION_KEYS.map((key) => {
  const [label, summary] = LABELS[key];
  return { key, module: moduleOf(key), label, summary };
});

export const PERMISSION_BY_KEY: ReadonlyMap<PermissionKey, PermissionDefinition> = new Map(
  PERMISSIONS.map((definition) => [definition.key, definition]),
);

export const MODULE_LABELS: Readonly<Record<PermissionModule, string>> = {
  workspace: "Workspace",
  node: "Drive",
  board: "Boards",
  row: "Records",
  document: "Documents",
  file: "Files",
  comment: "Comments",
  secret: "Secrets",
};

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  "workspace",
  "node",
  "board",
  "row",
  "document",
  "file",
  "comment",
  "secret",
];

/** Catalogue grouped for the matrix, in the module order above. */
export function permissionsByModule(): readonly {
  readonly module: PermissionModule;
  readonly label: string;
  readonly permissions: readonly PermissionDefinition[];
}[] {
  return PERMISSION_MODULES.map((module) => ({
    module,
    label: MODULE_LABELS[module],
    permissions: PERMISSIONS.filter((definition) => definition.module === module),
  }));
}

/** Human label for one key, used by the audit log and denial messages. */
export function permissionLabel(key: PermissionKey): string {
  return PERMISSION_BY_KEY.get(key)?.label ?? key;
}
