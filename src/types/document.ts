import type { UserSummary } from "./user";

export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph"
  | "quote"
  | "checklist"
  | "bulletList"
  | "numberedList"
  | "code"
  | "image"
  | "attachment"
  | "link"
  | "table"
  | "embed";

export type CodeLanguage =
  | "plaintext"
  | "typescript"
  | "javascript"
  | "json"
  | "sql"
  | "bash"
  | "python"
  | "go";

interface BlockBase {
  readonly id: string;
}

export interface TextBlock extends BlockBase {
  readonly type: "heading1" | "heading2" | "heading3" | "paragraph" | "quote";
  readonly text: string;
}

export interface ChecklistBlock extends BlockBase {
  readonly type: "checklist";
  readonly text: string;
  readonly isChecked: boolean;
}

export interface ListBlock extends BlockBase {
  readonly type: "bulletList" | "numberedList";
  readonly text: string;
}

export interface CodeBlock extends BlockBase {
  readonly type: "code";
  readonly code: string;
  readonly language: CodeLanguage;
}

export interface DocumentImage {
  readonly assetId: string | null;
  readonly url: string;
  readonly alt: string;
}

export interface ImageBlock extends BlockBase {
  readonly type: "image";
  readonly images: readonly DocumentImage[];
  readonly caption: string;
}

export interface AttachmentBlock extends BlockBase {
  readonly type: "attachment";
  readonly assetId: string | null;
  readonly name: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
}

export interface LinkBlock extends BlockBase {
  readonly type: "link";
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly siteName: string;
}

export interface TableBlock extends BlockBase {
  readonly type: "table";
  readonly hasHeaderRow: boolean;
  readonly rows: readonly (readonly string[])[];
}

export interface EmbedBlock extends BlockBase {
  readonly type: "embed";
  readonly boardNodeId: string | null;
  readonly viewId: string | null;
}

export type Block =
  | TextBlock
  | ChecklistBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | AttachmentBlock
  | LinkBlock
  | TableBlock
  | EmbedBlock;

export type TextualBlock = TextBlock | ChecklistBlock | ListBlock;

export type TextualBlockType = TextualBlock["type"];

export interface WorkspaceDocument {
  readonly id: string;
  readonly nodeId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly icon: string;
  readonly blocks: readonly Block[];
  readonly isPinned: boolean;
  readonly isLocked: boolean;
  readonly lockedBy: UserSummary | null;
  readonly isArchived: boolean;
  readonly owner: UserSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface DocumentDraft {
  readonly title: string;
  readonly icon: string;
  readonly blocks: readonly Block[];
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveState {
  readonly status: SaveStatus;
  readonly lastSavedAt: string | null;
  readonly error: string | null;
  readonly hasPendingChanges: boolean;
}

export type DocumentActionId =
  | "pin"
  | "unpin"
  | "lock"
  | "unlock"
  | "duplicate"
  | "move"
  | "archive"
  | "restore"
  | "delete";

export type CaretPosition = "start" | "end";

export interface FocusRequest {
  readonly blockId: string;
  readonly position: CaretPosition | number;
  readonly nonce: number;
}
