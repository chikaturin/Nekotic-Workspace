import type { AppError, AppErrorCode } from "@/types";

export class ServiceError extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "ServiceError";
    this.appError = appError;
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

interface AppErrorOptions {
  readonly detail?: string;
  readonly isRetryable?: boolean;
}

export function appError(
  code: AppErrorCode,
  message: string,
  { detail, isRetryable }: AppErrorOptions = {},
): AppError {
  return { code, message, detail, isRetryable: isRetryable ?? DEFAULT_RETRYABLE.has(code) };
}

const DEFAULT_RETRYABLE = new Set<AppErrorCode>(["network", "upload_failed", "unknown"]);

export const permissionDenied = (message: string, detail?: string): ServiceError =>
  new ServiceError(appError("permission_denied", message, { detail, isRetryable: false }));

export const notFound = (what: string): ServiceError =>
  new ServiceError(appError("not_found", `${what} could not be found`, { isRetryable: false }));

export const networkError = (detail?: string): ServiceError =>
  new ServiceError(appError("network", "Could not reach the workspace service", { detail }));

export const uploadFailed = (fileName: string, detail?: string): ServiceError =>
  new ServiceError(appError("upload_failed", `Upload of “${fileName}” failed`, { detail }));

export const cancelled = (what: string): ServiceError =>
  new ServiceError(appError("cancelled", `${what} was cancelled`, { isRetryable: false }));

export const conflict = (message: string, detail?: string): ServiceError =>
  new ServiceError(appError("conflict", message, { detail, isRetryable: false }));

export function toAppError(error: unknown): AppError {
  if (isServiceError(error)) return error.appError;

  if (error instanceof DOMException && error.name === "AbortError") {
    return appError("cancelled", "Request was cancelled", { isRetryable: false });
  }

  if (error instanceof Error) {
    return appError("unknown", "Something went wrong", { detail: error.message });
  }

  return appError("unknown", "Something went wrong");
}

export const isCancellation = (error: AppError): boolean => error.code === "cancelled";
