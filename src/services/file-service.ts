import {
  fileApi,
  type CompletedUpload,
  type UploadReference,
} from "@/services/api/file.api";
import { validateUpload } from "@/lib/file-validation";
import { ServiceError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Grid } from "@/lib/grid";
import type { FileNode, FilePreview } from "@/types";

export interface UploadInput {
  readonly file: File;
  readonly folderId: string | null;
  /** Chỗ tệp thuộc về; bỏ trống nghĩa là tải thẳng vào Drive. */
  readonly reference?: UploadReference;
  readonly onProgress: (progress: number) => void;
  readonly signal?: AbortSignal;
}

export interface ListFilesInput {
  readonly folderId: string;
  readonly signal?: AbortSignal;
}

export interface SaveTextResult {
  readonly sizeBytes: number;
  readonly savedAt: string;
}

const workspaceId = (): string =>
  useWorkspaceStore.getState().activeWorkspaceId;

export const fileService = {
  upload: async ({
    file,
    folderId,
    reference,
    onProgress,
    signal,
  }: UploadInput): Promise<CompletedUpload> => {
    const validationError = validateUpload(file);

    if (validationError) throw new ServiceError(validationError);

    const ticket = await fileApi.requestUpload(workspaceId(), {
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "application/octet-stream",
      folderId,
      // Tệp đính vào một chỗ cụ thể thì thuộc về chỗ đó, không phải Drive.
      createDriveNode: reference === undefined,
      ...(reference === undefined ? {} : { reference }),
    });

    await fileApi.sendBytes(ticket, file, onProgress, signal);

    return fileApi.completeUpload(ticket.uploadId);
  },

  abortUpload: (uploadId: string) => fileApi.abortUpload(uploadId),

  listFiles: ({ folderId, signal }: ListFilesInput): Promise<readonly FileNode[]> =>
    fileApi.listInFolder(folderId, signal),

  getPreview: (node: FileNode, signal?: AbortSignal): Promise<FilePreview> =>
    fileApi.preview(node.id, signal),

  saveText: (
    node: FileNode,
    content: string,
    signal?: AbortSignal,
  ): Promise<SaveTextResult> => {
    void signal;

    return fileApi.saveContent(node.id, { kind: "text", content });
  },

  saveSheet: (
    node: FileNode,
    rows: Grid,
    signal?: AbortSignal,
  ): Promise<SaveTextResult> => {
    void signal;

    return fileApi.saveContent(node.id, {
      kind: "sheet",
      rows: rows.map((row) => row.map((cell) => String(cell ?? ""))),
    });
  },

  getDownloadUrl: async (node: FileNode): Promise<string> =>
    (await fileApi.downloadUrl(node.id)).url,

  getAssetUrl: async (assetId: string): Promise<string> =>
    (await fileApi.assetUrl(assetId)).url,
};
