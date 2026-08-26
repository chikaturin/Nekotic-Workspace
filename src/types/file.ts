import type { Grid } from "@/lib/grid";
import type { AppError } from "./async";
import type { FileKind } from "./node";
import type { UserSummary } from "./user";

/** A stored file, independent of where it is referenced from. */
export interface FileAsset {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly kind: FileKind;
  readonly owner: UserSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Folder the asset belongs to; null for workspace-level uploads. */
  readonly folderId: string | null;
}

/** Everything the preview surface needs, resolved by the service. */
export type FilePreview =
  | { readonly kind: "image"; readonly url: string; readonly alt: string }
  | { readonly kind: "pdf"; readonly url: string }
  | { readonly kind: "text"; readonly content: string; readonly language: string }
  | { readonly kind: "sheet"; readonly rows: Grid; readonly sheetName: string }
  | { readonly kind: "unsupported"; readonly reason: string };

export type UploadStatus = "queued" | "uploading" | "success" | "error" | "cancelled";

export interface UploadTask {
  readonly id: string;
  readonly fileName: string;
  /** Destination folder; null uploads to the workspace root. */
  readonly folderId: string | null;
  readonly sizeBytes: number;
  readonly mimeType: string;
  /** 0 – 1. */
  readonly progress: number;
  readonly status: UploadStatus;
  readonly error: AppError | null;
  /** Set once the upload completes. */
  readonly assetId: string | null;
  /** Scopes a task to one surface (a board cell, say) without hiding it from
   * the global tray. */
  readonly tag?: string;
}

export interface UploadSummary {
  readonly total: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  /** Aggregate progress across every task, 0 – 1. */
  readonly progress: number;
}

/** Metadata rows rendered for any file, previewable or not. */
export interface FileMetadataEntry {
  readonly label: string;
  readonly value: string;
}
