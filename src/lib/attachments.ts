import { extensionOf } from "@/lib/node-visuals";
import { previewStrategyFor, type PreviewStrategy } from "@/lib/preview-strategy";
import type { BoardColumn, BoardRow, CellAttachment, FileAsset, FileKind } from "@/types";

/**
 * Attachments on a board record.
 *
 * One rule holds the whole feature together: the board record's attachment
 * cell *is* the storage. The table cell, the drawer section and the viewer all
 * read and write that one value, so there is no `tableAttachments` and no
 * `drawerAttachments` to keep in step.
 */

/** Images that can be shown inline. SVG is excluded on purpose — see below. */
const INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/**
 * SVG is markup, and rendering uploaded markup in the app's own origin is how
 * an upload becomes stored XSS. SVGs are treated as downloadable files, never
 * as inline images — the same reason nothing here ever renders uploaded HTML.
 */
export const NON_RENDERABLE_TYPES = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

/**
 * A declared MIME type is not trustworthy on its own, and neither is a file
 * extension — the client may set either. Both have to agree before the byte
 * stream is put in an `<img>`, and an explicitly non-renderable type is
 * refused whatever the name says.
 */
export function isImageAttachment(file: CellAttachment): boolean {
  if (NON_RENDERABLE_TYPES.has(file.mimeType)) return false;

  return INLINE_IMAGE_TYPES.has(file.mimeType) && IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

/** Coarse file class, used for the icon on a non-image attachment. */
export function attachmentKind(file: CellAttachment): FileKind {
  if (isImageAttachment(file)) return "image";
  if (file.mimeType === "application/pdf") return "pdf";
  if (file.mimeType.startsWith("video/")) return "video";
  if (file.mimeType.startsWith("audio/")) return "audio";

  const extension = extensionOf(file.name);
  if (["zip", "rar", "gz", "7z", "tar"].includes(extension)) return "archive";
  if (["csv", "tsv", "xlsx", "xls"].includes(extension)) return "spreadsheet";
  if (["json", "ts", "tsx", "js", "log", "yml", "yaml", "sql", "sh"].includes(extension)) {
    return "code";
  }
  if (["txt", "md", "doc", "docx"].includes(extension)) return "document";

  return "other";
}

/**
 * How an attachment should be shown when it is opened.
 *
 * The same strategy table the Drive viewer uses, so a PDF behaves identically
 * whether it arrived as a file in a folder or as evidence on a bug.
 */
export function attachmentPreview(file: CellAttachment): PreviewStrategy {
  if (NON_RENDERABLE_TYPES.has(file.mimeType)) return "none";

  return previewStrategyFor({
    kind: attachmentKind(file),
    extension: extensionOf(file.name),
    mimeType: file.mimeType,
  });
}

/** True when the attachment has bytes this session can actually reach. */
export function isReachable(file: CellAttachment): boolean {
  return typeof file.url === "string" && file.url.length > 0;
}

/** An uploaded asset, as the board stores it. Metadata only — never bytes. */
export function attachmentFromAsset(
  asset: FileAsset,
  url: string | null,
  thumbnailUrl: string | null,
): CellAttachment {
  return {
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    url,
    thumbnailUrl,
    uploadedBy: asset.owner.id,
    createdAt: asset.createdAt,
  };
}

/* ----------------------------------------------------------------- fields */

/** Attachment columns of a board, in schema order. */
export function attachmentColumns(columns: readonly BoardColumn[]): readonly BoardColumn[] {
  return columns.filter((column) => column.type === "attachment");
}

/** The files stored in one attachment column of one record. */
export function attachmentsOf(row: BoardRow | undefined, columnId: string): readonly CellAttachment[] {
  const value = row?.cells[columnId];
  return value && value.kind === "attachment" ? value.attachments : [];
}

/** Every attachment on a record, across all of its attachment columns. */
export function allAttachmentsOf(
  row: BoardRow | undefined,
  columns: readonly BoardColumn[],
): readonly CellAttachment[] {
  return attachmentColumns(columns).flatMap((column) => attachmentsOf(row, column.id));
}

/** The images among a set, in order — what the lightbox pages through. */
export function imagesAmong(files: readonly CellAttachment[]): readonly CellAttachment[] {
  return files.filter((file) => isImageAttachment(file) && isReachable(file));
}
