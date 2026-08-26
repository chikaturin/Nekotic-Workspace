import { delimiterFor, parseDelimited, toDelimited } from "@/lib/csv";
import { trimGrid, type Grid } from "@/lib/grid";
import { extensionOf, kindFromFileName } from "@/lib/node-visuals";
import { buildPdf, pdfToBytes } from "@/lib/pdf";
import { buildXlsx, parseXlsx } from "@/lib/xlsx";
import { validateUpload } from "@/lib/file-validation";
import { previewStrategyFor } from "@/lib/preview-strategy";
import { svgPreview } from "@/mock/preview";
import { mockSheet } from "@/mock/sheet";
import {
  assertNoSimulatedListFailure,
  delay,
  isSimulatedEmpty,
  nextId,
  nowIso,
  readDelay,
  writeDelay,
} from "@/services/backend";
import { getSimulation, LATENCY_MS } from "@/services/simulation";
import {
  appError,
  cancelled,
  notFound,
  permissionDenied,
  ServiceError,
  uploadFailed,
} from "@/services/errors";
import { shouldFailSave, shouldFailUpload } from "@/services/simulation";
import { findNodeById } from "@/lib/tree";
import { getActiveTree } from "@/store/workspace-store";
import { childrenOf, isFile } from "@/types";
import type { FileAsset, FileNode, FilePreview, UserSummary } from "@/types";

/** Real bytes for uploaded files, so previews and downloads are genuine. */
const blobs = new Map<string, Blob>();
/** Object URLs handed to the UI, tracked so they can be revoked. */
const objectUrls = new Map<string, string>();

const UPLOAD_STEPS = 12;
/** A transfer takes a few round trips; the profile keeps tests quick. */
const UPLOAD_DURATION_FACTOR = 4;

export interface UploadInput {
  readonly file: File;
  readonly folderId: string | null;
  readonly owner: UserSummary;
  readonly onProgress: (progress: number) => void;
  readonly signal?: AbortSignal;
}

/**
 * Upload a file, reporting progress as it goes. The bytes are kept in memory so
 * the preview and download paths behave exactly like they would against a CDN.
 */
async function upload({ file, folderId, owner, onProgress, signal }: UploadInput): Promise<FileAsset> {
  const validationError = validateUpload(file);
  if (validationError) throw new ServiceError(validationError);

  const duration = LATENCY_MS[getSimulation().latency] * UPLOAD_DURATION_FACTOR;
  const stepDuration = Math.max(1, Math.round(duration / UPLOAD_STEPS));

  for (let step = 1; step <= UPLOAD_STEPS; step += 1) {
    await delay(stepDuration, signal);

    // Fail late, the way a real transfer usually does.
    if (step === UPLOAD_STEPS - 2 && shouldFailUpload(file.name)) {
      throw uploadFailed(file.name, "The connection dropped before the transfer finished.");
    }

    onProgress(step / UPLOAD_STEPS);
  }

  if (signal?.aborted) throw cancelled(`Upload of “${file.name}”`);

  const id = nextId("asset");
  blobs.set(id, file);

  return {
    id,
    name: file.name,
    extension: extensionOf(file.name),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    kind: kindFromFileName(file.name),
    owner,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    folderId,
  };
}

export interface ListFilesInput {
  /** Folder being opened; null lists the workspace root. */
  readonly folderId: string | null;
  /** Whether the caller may view this folder at all. */
  readonly canView: boolean;
  readonly signal?: AbortSignal;
}

/**
 * Apply read latency, access policy and the simulation switches to a file
 * listing. The catalog itself lives in the workspace tree; this is the seam
 * that a real `GET /folders/:id/files` would replace.
 */
async function listFiles({ folderId, canView, signal }: ListFilesInput): Promise<readonly FileNode[]> {
  await readDelay(signal);

  const tree = getActiveTree();
  const folder = folderId ? findNodeById(tree, folderId) : null;

  if (folderId && !folder) throw notFound("That folder");

  if (!canView) {
    throw permissionDenied(
      folder ? `You do not have access to “${folder.name}”` : "You do not have access to this folder",
      "Ask the owner to share it with you.",
    );
  }

  assertNoSimulatedListFailure(folder ? `“${folder.name}”` : "the workspace root");
  if (isSimulatedEmpty()) return [];

  const pool = folder ? childrenOf(folder) : tree;
  return pool.filter((node): node is FileNode => isFile(node) && !node.isTrashed);
}

/** Resolve what the preview surface should render for a file. */
async function getPreview(node: FileNode, signal?: AbortSignal): Promise<FilePreview> {
  await readDelay(signal);

  const strategy = previewStrategyFor(node);
  const uploaded = blobs.get(node.id);

  switch (strategy) {
    case "image":
      return uploaded
        ? { kind: "image", url: urlFor(node.id, uploaded), alt: node.name }
        : {
            kind: "image",
            url: node.previewUrl ?? svgPreview(node.id, node.name),
            alt: node.name,
          };

    case "pdf":
      return { kind: "pdf", url: urlFor(node.id, uploaded ?? mockPdfBlob(node)) };

    case "text": {
      const content = uploaded ? await uploaded.text() : mockTextContent(node);
      return { kind: "text", content, language: node.extension };
    }

    case "sheet": {
      const rows = await readSheet(node, uploaded);
      return { kind: "sheet", rows, sheetName: sheetNameFor(node) };
    }

    case "none":
      return { kind: "unsupported", reason: unsupportedReason(node) };
  }
}

export interface SaveTextResult {
  readonly sizeBytes: number;
  readonly savedAt: string;
}

/**
 * Persist edited text back onto a file. The new bytes replace whatever the
 * preview and download paths were reading, so an edit is immediately visible
 * everywhere — exactly what a real `PUT /files/:id/content` would give us.
 */
async function saveText(node: FileNode, content: string, signal?: AbortSignal): Promise<SaveTextResult> {
  await writeDelay(signal);

  if (previewStrategyFor(node) !== "text") {
    throw new ServiceError(
      appError("conflict", `“${node.name}” is not a text file`, { isRetryable: false }),
    );
  }

  if (shouldFailSave(node.name)) {
    throw new ServiceError(
      appError("unknown", `Could not save “${node.name}”`, {
        detail: "The write was rejected by the storage backend.",
      }),
    );
  }

  if (signal?.aborted) throw cancelled(`Save of “${node.name}”`);

  const blob = new Blob([content], { type: node.mimeType || "text/plain" });
  blobs.set(node.id, blob);
  invalidateUrl(node.id);

  return { sizeBytes: blob.size, savedAt: nowIso() };
}

/**
 * Persist a spreadsheet. CSV and TSV are written as delimited text; `.xlsx`
 * is written as a real workbook, so the file that comes back out of Download
 * opens in Excel or Sheets.
 */
async function saveSheet(node: FileNode, rows: Grid, signal?: AbortSignal): Promise<SaveTextResult> {
  await writeDelay(signal);

  if (previewStrategyFor(node) !== "sheet") {
    throw new ServiceError(
      appError("conflict", `“${node.name}” is not a spreadsheet`, { isRetryable: false }),
    );
  }

  if (shouldFailSave(node.name)) {
    throw new ServiceError(
      appError("unknown", `Could not save “${node.name}”`, {
        detail: "The write was rejected by the storage backend.",
      }),
    );
  }

  if (signal?.aborted) throw cancelled(`Save of “${node.name}”`);

  const blob = sheetToBlob(node, trimGrid(rows));
  blobs.set(node.id, blob);
  invalidateUrl(node.id);

  return { sizeBytes: blob.size, savedAt: nowIso() };
}

/** URL suitable for an `<a download>` — real bytes whenever we have them. */
async function getDownloadUrl(node: FileNode): Promise<string> {
  const uploaded = blobs.get(node.id);
  if (uploaded) return urlFor(node.id, uploaded);

  const strategy = previewStrategyFor(node);
  if (strategy === "image" && node.previewUrl) return node.previewUrl;
  if (strategy === "pdf") return urlFor(node.id, mockPdfBlob(node));
  if (strategy === "sheet") return urlFor(node.id, sheetToBlob(node, mockSheet(node.id, node.name)));

  const text =
    previewStrategyFor(node) === "text"
      ? mockTextContent(node)
      : `${node.name} — placeholder generated by the NexDrop mock service.`;

  return urlFor(node.id, new Blob([text], { type: node.mimeType || "text/plain" }));
}

/** Object URL for an asset uploaded this session, or null once it is gone. */
function getAssetUrl(assetId: string): string | null {
  const blob = blobs.get(assetId);
  return blob ? urlFor(assetId, blob) : null;
}

/** Register the original bytes of a file that was uploaded elsewhere. */
function attachBlob(assetId: string, blob: Blob): void {
  blobs.set(assetId, blob);
}

/**
 * Drop every object URL. Individual URLs are deliberately *not* revoked when a
 * preview closes: the same asset id is also referenced by image blocks inside
 * documents, and revoking under them would break an image that is still on
 * screen. The cache is one URL per asset the session has opened.
 */
function releaseAll(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

/* ----------------------------------------------------------------- helpers */

function urlFor(assetId: string, blob: Blob): string {
  const existing = objectUrls.get(assetId);
  if (existing) return existing;

  if (typeof URL.createObjectURL !== "function") {
    throw new ServiceError(
      appError("unknown", "Previews are unavailable in this environment", { isRetryable: false }),
    );
  }

  const url = URL.createObjectURL(blob);
  objectUrls.set(assetId, url);
  return url;
}

/** Drop the cached object URL so the next read serves the new bytes. */
function invalidateUrl(assetId: string): void {
  const existing = objectUrls.get(assetId);
  if (!existing) return;

  URL.revokeObjectURL(existing);
  objectUrls.delete(assetId);
}

function mockPdfBlob(node: FileNode): Blob {
  const lines = (node.excerpt ?? "Generated preview document.").split("\n").slice(0, 24);
  const pdf = buildPdf({ title: node.name, lines });
  return new Blob([pdfToBytes(pdf)], { type: "application/pdf" });
}

function sheetNameFor(node: FileNode): string {
  return node.name.replace(/\.[^.]+$/, "").slice(0, 31) || "Sheet1";
}

async function readSheet(node: FileNode, uploaded: Blob | undefined): Promise<Grid> {
  if (!uploaded) return mockSheet(node.id, node.name);

  if (node.extension.toLowerCase() === "xlsx") {
    const workbook = await parseXlsx(new Uint8Array(await uploaded.arrayBuffer()));
    return workbook.rows;
  }

  return parseDelimited(await uploaded.text(), delimiterFor(node.extension));
}

function sheetToBlob(node: FileNode, rows: Grid): Blob {
  if (node.extension.toLowerCase() === "xlsx") {
    return new Blob([buildXlsx(rows, sheetNameFor(node))], { type: node.mimeType });
  }

  return new Blob([toDelimited(rows, delimiterFor(node.extension))], {
    type: node.mimeType || "text/csv",
  });
}

function mockTextContent(node: FileNode): string {
  if (node.excerpt && node.excerpt.length > 0) return node.excerpt;

  return [
    `# ${node.name}`,
    "",
    "This file has no stored preview content in the mock dataset.",
    `Type: ${node.mimeType}`,
  ].join("\n");
}

function unsupportedReason(node: FileNode): string {
  const label = node.extension ? node.extension.toUpperCase() : "This";
  return `${label} files cannot be previewed in the browser. Download the file to open it.`;
}

export const fileService = {
  upload,
  listFiles,
  getPreview,
  saveText,
  saveSheet,
  getDownloadUrl,
  getAssetUrl,
  attachBlob,
  releaseAll,
};
