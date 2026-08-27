import type { UserSummary } from "./user";

/**
 * How a node decides who may see it (SY-FAC).
 *
 * Three modes and no more: the point is that an ordinary person can look at a
 * folder and say what it does. Anything finer belongs in the role matrix.
 */
export type NodeAccessMode =
  /** Whatever the nearest ancestor decided. The default. */
  | "inherit"
  /** Every member of the workspace, regardless of what an ancestor said. */
  | "workspace"
  /** Only the subjects granted here. Stops inheritance at this node. */
  | "restricted";

export const NODE_ACCESS_MODES: readonly NodeAccessMode[] = [
  "inherit",
  "workspace",
  "restricted",
];

/** Every addressable entity inside a workspace tree. */
export type DriveNodeType = "project" | "folder" | "document" | "board" | "file";

/** Coarse file classification driving icon, color and preview strategy. */
export type FileKind =
  | "image"
  | "document"
  | "spreadsheet"
  | "pdf"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "other";

export type BoardKind = "kanban" | "table" | "timeline" | "doc";

/**
 * Documents come in three shapes. They share routing, permissions and the
 * pin/lock/archive lifecycle; only their editor differs.
 */
export type DocumentKind = "page" | "config" | "secret";

export type ProjectStatus = "active" | "paused" | "archived";

interface DriveNodeBase {
  readonly id: string;
  readonly name: string;
  /** URL-safe segment, unique among siblings — the routing key. */
  readonly slug: string;
  readonly parentId: string | null;
  readonly workspaceId: string;
  readonly owner: UserSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isFavorite: boolean;
  readonly isTrashed: boolean;
  readonly isShared: boolean;
  /**
   * Frozen out of the active workspace (SY-ARC-37). Archiving is inherited:
   * everything below an archived container is read-only too — resolved through
   * `lib/archive`, never by reading this flag alone.
   */
  readonly isArchived?: boolean;
  /**
   * Who may *see* this node, as opposed to what they may do with it.
   *
   * Absent means `inherit`, which is what almost every node is: whatever the
   * nearest ancestor decided. `restricted` stops the flow and admits only the
   * subjects granted here; `workspace` opens it back up to every member.
   *
   * This is resource access, not capability. It is resolved by
   * `lib/permissions/visibility`, never by reading the flag on one node.
   */
  readonly accessMode?: NodeAccessMode;
}

export interface ProjectNode extends DriveNodeBase {
  readonly type: "project";
  readonly description?: string;
  readonly status: ProjectStatus;
  readonly color: string;
  readonly children: readonly DriveNode[];
}

export interface FolderNode extends DriveNodeBase {
  readonly type: "folder";
  readonly children: readonly DriveNode[];
  readonly color?: string;
}

/** A block-based page. Its blocks live in the document service, not the tree. */
export interface DocumentNode extends DriveNodeBase {
  readonly type: "document";
  /** Absent means a block page — the original document kind. */
  readonly documentKind?: DocumentKind;
  readonly icon: string;
  readonly blockCount: number;
  readonly isPinned: boolean;
  readonly isLocked: boolean;
  readonly isArchived: boolean;
  readonly excerpt: string;
}

export interface BoardNode extends DriveNodeBase {
  readonly type: "board";
  readonly boardKind: BoardKind;
  /** Template the board was generated from; absent uses the default schema. */
  readonly templateId?: string;
  readonly itemCount: number;
  readonly openCount: number;
}

export interface FileNode extends DriveNodeBase {
  readonly type: "file";
  readonly kind: FileKind;
  readonly extension: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Source used by the quick-preview modal (image src, text blob, …). */
  readonly previewUrl?: string;
  readonly thumbnailUrl?: string;
  /** Plain-text excerpt rendered by the preview modal for text-like files. */
  readonly excerpt?: string;
  readonly version: number;
}

export type DriveNode = ProjectNode | FolderNode | DocumentNode | BoardNode | FileNode;

/** Nodes that can hold children and therefore act as drop targets. */
export type ContainerNode = ProjectNode | FolderNode;

/** Nodes that are leaves in the tree. */
export type LeafNode = DocumentNode | BoardNode | FileNode;

export const isProject = (node: DriveNode): node is ProjectNode => node.type === "project";
export const isFolder = (node: DriveNode): node is FolderNode => node.type === "folder";
export const isDocument = (node: DriveNode): node is DocumentNode => node.type === "document";
export const isBoard = (node: DriveNode): node is BoardNode => node.type === "board";
export const isFile = (node: DriveNode): node is FileNode => node.type === "file";

export const documentKindOf = (node: DocumentNode): DocumentKind => node.documentKind ?? "page";

export const isContainer = (node: DriveNode): node is ContainerNode =>
  node.type === "project" || node.type === "folder";

/** Children of a node, or an empty tuple for leaves. Never returns undefined. */
export const childrenOf = (node: DriveNode): readonly DriveNode[] =>
  isContainer(node) ? node.children : [];
