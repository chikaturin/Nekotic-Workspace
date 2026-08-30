import type { Grid } from "@/lib/grid";
import type { AppError } from "./async";
import type { FileKind } from "./node";
import type { UserSummary } from "./user";

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
  readonly folderId: string | null;
  readonly previewUrl?: string | null;
  readonly thumbnailUrl?: string | null;
}

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
  readonly folderId: string | null;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly progress: number;
  readonly status: UploadStatus;
  readonly error: AppError | null;
  readonly assetId: string | null;
  readonly tag?: string;
}

export interface UploadSummary {
  readonly total: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly progress: number;
}

export interface FileMetadataEntry {
  readonly label: string;
  readonly value: string;
}
