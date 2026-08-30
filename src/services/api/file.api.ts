import { UPLOAD_TIMEOUT_MS } from "@/config/api";
import { uploadFailed } from "@/services/errors";
import { apiFetch, apiSend } from "@/services/http/client";
import type { FileAsset, FileNode, FilePreview, StorageQuota } from "@/types";

export interface FileAssetWithPreview extends FileAsset {
  readonly previewUrl: string | null;
  readonly thumbnailUrl: string | null;
}

export interface UploadTicket {
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly method: "PUT" | "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
  readonly maxBytes: number;
}

export interface CompletedUpload {
  readonly asset: FileAssetWithPreview;
  readonly node: { readonly id: string; readonly name: string } | null;
  readonly storage: StorageQuota;
}

/**
 * Tệp này thuộc về đâu.
 *
 * Có `reference` nghĩa là tệp nằm BÊN TRONG một thứ khác — ô của board, khối
 * trong trang, bình luận — nên nó không được hiện ra như một mục Drive.
 * Không có `reference` nghĩa là người dùng tải thẳng vào Drive.
 */
export type UploadReference =
  | { readonly kind: "cell"; readonly rowId?: string; readonly columnId?: string }
  | { readonly kind: "comment"; readonly commentId?: string }
  | { readonly kind: "block"; readonly nodeId?: string };

export interface RequestUploadInput {
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly folderId: string | null;
  readonly createDriveNode: boolean;
  readonly reference?: UploadReference;
}

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: string;
  readonly thumbnailUrl?: string;
}

const contentTypeOf = (ticket: UploadTicket): string =>
  ticket.headers["Content-Type"] ?? "application/octet-stream";

function sendWithProgress(
  ticket: UploadTicket,
  file: Blob,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open(ticket.method, ticket.uploadUrl, true);
    request.timeout = UPLOAD_TIMEOUT_MS;
    request.setRequestHeader("Content-Type", contentTypeOf(ticket));

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();

        return;
      }

      reject(
        uploadFailed(
          ticket.uploadId,
          `Storage answered ${String(request.status)}.`,
        ),
      );
    });

    request.addEventListener("error", () =>
      reject(uploadFailed(ticket.uploadId, "The connection dropped.")),
    );
    request.addEventListener("timeout", () =>
      reject(uploadFailed(ticket.uploadId, "The transfer timed out.")),
    );
    request.addEventListener("abort", () =>
      reject(uploadFailed(ticket.uploadId, "The upload was cancelled.")),
    );

    signal?.addEventListener("abort", () => request.abort(), { once: true });

    request.send(file);
  });
}

async function sendWithFetch(
  ticket: UploadTicket,
  file: Blob,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: { "Content-Type": contentTypeOf(ticket) },
    body: file,
    ...(signal === undefined ? {} : { signal }),
  });

  if (!response.ok) {
    throw uploadFailed(
      ticket.uploadId,
      `Storage answered ${String(response.status)}.`,
    );
  }

  onProgress(1);
}

export const fileApi = {
  requestUpload: (workspaceId: string, input: RequestUploadInput) =>
    apiFetch<UploadTicket>(`/workspaces/${workspaceId}/uploads`, {
      method: "POST",
      body: input,
    }),

  sendBytes: (
    ticket: UploadTicket,
    file: Blob,
    onProgress: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<void> =>
    typeof XMLHttpRequest === "undefined"
      ? sendWithFetch(ticket, file, onProgress, signal)
      : sendWithProgress(ticket, file, onProgress, signal),

  completeUpload: (uploadId: string, checksum?: string) =>
    apiFetch<CompletedUpload>(`/uploads/${uploadId}/complete`, {
      method: "POST",
      body: checksum === undefined ? {} : { checksum },
    }),

  abortUpload: (uploadId: string) =>
    apiSend(`/uploads/${uploadId}`, { method: "DELETE" }),

  listInFolder: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<readonly FileNode[]>(`/folders/${nodeId}/files`, { signal }),

  preview: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<FilePreview>(`/nodes/${nodeId}/file/preview`, { signal }),

  saveContent: (
    nodeId: string,
    content:
      | { readonly kind: "text"; readonly content: string }
      | {
          readonly kind: "sheet";
          readonly rows: readonly (readonly string[])[];
        },
  ) =>
    apiFetch<{ readonly sizeBytes: number; readonly savedAt: string }>(
      `/nodes/${nodeId}/file/content`,
      { method: "PUT", body: content },
    ),

  downloadUrl: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<SignedUrl>(`/nodes/${nodeId}/file/download`, { signal }),

  assetUrl: (assetId: string, signal?: AbortSignal) =>
    apiFetch<SignedUrl>(`/assets/${assetId}/url`, { signal }),

  resolveLink: (url: string, signal?: AbortSignal) =>
    apiFetch<{
      readonly url: string;
      readonly title?: string;
      readonly description?: string;
      readonly imageUrl?: string;
      readonly siteName?: string;
    }>("/links/resolve", { method: "POST", body: { url }, signal }),
};
