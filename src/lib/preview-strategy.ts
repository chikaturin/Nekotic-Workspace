import type { FileKind } from "@/types";

export type PreviewStrategy = "image" | "pdf" | "text" | "sheet" | "none";

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

const SHEET_EXTENSIONS = new Set(["csv", "tsv", "xlsx"]);

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

export function previewStrategyFor({ kind, extension, mimeType }: PreviewCandidate): PreviewStrategy {
  const normalized = extension.toLowerCase();

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
