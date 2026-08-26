import { extensionOf } from "@/lib/node-visuals";
import type { AppError } from "@/types";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Extensions the workspace accepts, grouped for the UI hint text. */
export const ACCEPTED_EXTENSIONS = {
  documents: ["pdf", "txt", "md"],
  images: ["png", "jpg", "jpeg"],
  data: ["xlsx", "csv"],
  code: ["ts", "tsx", "js", "jsx", "json", "sql", "py", "go", "sh", "yml", "yaml"],
} as const;

export const ALL_ACCEPTED_EXTENSIONS: readonly string[] = Object.values(ACCEPTED_EXTENSIONS).flat();

/** `accept` attribute for the hidden file input. */
export const ACCEPT_ATTRIBUTE = ALL_ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/** `accept` for image-only pickers — the same list the validator enforces. */
export const IMAGE_ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.images.map((ext) => `.${ext}`).join(",");

export const ACCEPTED_HINT = "PDF, PNG, JPG, XLSX, CSV, TXT and source code · up to 25 MB";

/**
 * Validate a file before it reaches the service.
 * Returns null when the file is acceptable.
 */
export function validateUpload(file: File): AppError | null {
  if (file.size === 0) {
    return {
      code: "validation",
      message: `“${file.name}” is empty`,
      detail: "Files must contain at least one byte.",
      isRetryable: false,
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      code: "validation",
      message: `“${file.name}” exceeds the 25 MB limit`,
      detail: `The file is ${Math.round(file.size / 1024 / 1024)} MB.`,
      isRetryable: false,
    };
  }

  const extension = extensionOf(file.name);
  if (!ALL_ACCEPTED_EXTENSIONS.includes(extension)) {
    return {
      code: "validation",
      message: `“${file.name}” is not an accepted file type`,
      detail: ACCEPTED_HINT,
      isRetryable: false,
    };
  }

  return null;
}

/** Split a drop into files the workspace accepts and the rejections. */
export function partitionUploads(files: readonly File[]): {
  readonly accepted: readonly File[];
  readonly rejected: readonly { file: File; error: AppError }[];
} {
  const accepted: File[] = [];
  const rejected: { file: File; error: AppError }[] = [];

  for (const file of files) {
    const error = validateUpload(file);
    if (error) {
      rejected.push({ file, error });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}
