import type { UserSummary } from "./user";

export type NodeAccessMode =
  | "inherit"
  | "workspace"
  | "restricted";

export const NODE_ACCESS_MODES: readonly NodeAccessMode[] = [
  "inherit",
  "workspace",
  "restricted",
];

export type DriveNodeType = "project" | "folder" | "document" | "board" | "file";

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

export type DocumentKind = "page" | "config" | "secret";

export type ProjectStatus = "active" | "paused" | "archived";

interface DriveNodeBase {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parentId: string | null;
  readonly workspaceId: string;
  readonly owner: UserSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isFavorite: boolean;
  /** Ghim lên thanh bên — mọi loại node đều ghim được, không riêng trang. */
  readonly isPinned: boolean;
  readonly isTrashed: boolean;
  readonly isShared: boolean;
  readonly isArchived?: boolean;
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

export interface DocumentNode extends DriveNodeBase {
  readonly type: "document";
  readonly documentKind?: DocumentKind;
  readonly icon: string;
  readonly blockCount: number;
  readonly isLocked: boolean;
  readonly isArchived: boolean;
  readonly excerpt: string;
}

export interface BoardNode extends DriveNodeBase {
  readonly type: "board";
  readonly boardKind: BoardKind;
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
  readonly previewUrl?: string;
  readonly thumbnailUrl?: string;
  readonly excerpt?: string;
  readonly version: number;
}

export type DriveNode = ProjectNode | FolderNode | DocumentNode | BoardNode | FileNode;

export type ContainerNode = ProjectNode | FolderNode;

export type LeafNode = DocumentNode | BoardNode | FileNode;

export const isProject = (node: DriveNode): node is ProjectNode => node.type === "project";
export const isFolder = (node: DriveNode): node is FolderNode => node.type === "folder";
export const isDocument = (node: DriveNode): node is DocumentNode => node.type === "document";
export const isBoard = (node: DriveNode): node is BoardNode => node.type === "board";
export const isFile = (node: DriveNode): node is FileNode => node.type === "file";

export const documentKindOf = (node: DocumentNode): DocumentKind => node.documentKind ?? "page";

export const isContainer = (node: DriveNode): node is ContainerNode =>
  node.type === "project" || node.type === "folder";

export const childrenOf = (node: DriveNode): readonly DriveNode[] =>
  isContainer(node) ? node.children : [];
