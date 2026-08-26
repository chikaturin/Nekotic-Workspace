import type { FileKind } from "@/types";

export type PreviewStrategy = "image" | "pdf" | "text" | "sheet" | "none";

/**
 * Extensions whose bytes are plain text. Deciding by extension rather than by
 * `FileKind` matters: `xlsx` and `csv` are both "spreadsheets", but only one of
 * them is readable as text — the other is a zip container.
 */
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "yml",
  "yaml",
  "xml",
  "html",
  "css",
  "sql",
  "sh",
  "bash",
  "zsh",
  "env",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "rb",
  "php",
  "c",
  "h",
  "cpp",
  "tf",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"]);

/**
 * Tabular formats open in the grid editor. `xlsx` is a zip container, but the
 * workbook reader unpacks it, so it belongs here rather than with the binaries.
 */
const SHEET_EXTENSIONS = new Set(["csv", "tsv", "xlsx"]);

/**
 * Extensions we know are containers or media. Listing them explicitly lets a
 * known extension outrank a wrong or generic MIME type.
 */
const BINARY_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "webm",
  "avi",
  "mkv",
  "mp3",
  "wav",
  "flac",
  "aac",
  "zip",
  "rar",
  "gz",
  "7z",
  "tar",
  "xls",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "bin",
  "exe",
  "dmg",
  "iso",
]);

interface PreviewCandidate {
  readonly kind: FileKind;
  readonly extension: string;
  readonly mimeType?: string;
}

/** How a file should be previewed, or `none` when only metadata makes sense. */
export function previewStrategyFor({ kind, extension, mimeType }: PreviewCandidate): PreviewStrategy {
  const normalized = extension.toLowerCase();

  // A recognised extension is authoritative — MIME types are often generic and
  // sometimes plain wrong.
  if (IMAGE_EXTENSIONS.has(normalized)) return "image";
  if (normalized === "pdf") return "pdf";
  if (SHEET_EXTENSIONS.has(normalized)) return "sheet";
  if (TEXT_EXTENSIONS.has(normalized)) return "text";
  if (BINARY_EXTENSIONS.has(normalized)) return "none";

  if (kind === "image") return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType?.startsWith("text/")) return "text";

  return "none";
}
