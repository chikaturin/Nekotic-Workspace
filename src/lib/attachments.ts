import { extensionOf } from "@/lib/node-visuals";
import { previewStrategyFor, type PreviewStrategy } from "@/lib/preview-strategy";
import type { BoardColumn, BoardRow, CellAttachment, FileAsset, FileKind } from "@/types";

const INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const NON_RENDERABLE_TYPES = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export function isImageAttachment(file: CellAttachment): boolean {
  if (NON_RENDERABLE_TYPES.has(file.mimeType)) return false;

  return INLINE_IMAGE_TYPES.has(file.mimeType) && IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

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

export function attachmentPreview(file: CellAttachment): PreviewStrategy {
  if (NON_RENDERABLE_TYPES.has(file.mimeType)) return "none";

  return previewStrategyFor({
    kind: attachmentKind(file),
    extension: extensionOf(file.name),
    mimeType: file.mimeType,
  });
}

export function isReachable(file: CellAttachment): boolean {
  return typeof file.url === "string" && file.url.length > 0;
}

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

export function attachmentColumns(columns: readonly BoardColumn[]): readonly BoardColumn[] {
  return columns.filter((column) => column.type === "attachment");
}

export function attachmentsOf(row: BoardRow | undefined, columnId: string): readonly CellAttachment[] {
  const value = row?.cells[columnId];
  return value && value.kind === "attachment" ? value.attachments : [];
}

export function allAttachmentsOf(
  row: BoardRow | undefined,
  columns: readonly BoardColumn[],
): readonly CellAttachment[] {
  return attachmentColumns(columns).flatMap((column) => attachmentsOf(row, column.id));
}
