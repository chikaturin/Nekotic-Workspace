import { appError, ServiceError } from "@/services/errors";
import type { AppError, AppErrorCode } from "@/types";

interface WireError {
  readonly code?: string;
  readonly message?: string;
  readonly detail?: string;
  readonly isRetryable?: boolean;
  readonly reason?: string;
  readonly retryAfterSeconds?: number;
}

const KNOWN_CODES = new Set<AppErrorCode>([
  "permission_denied",
  "not_found",
  "network",
  "validation",
  "upload_failed",
  "conflict",
  "unknown",
]);

const CODE_BY_STATUS: Readonly<Record<number, AppErrorCode>> = {
  400: "validation",
  401: "permission_denied",
  403: "permission_denied",
  404: "not_found",
  409: "conflict",
  413: "validation",
  415: "validation",
  422: "upload_failed",
  429: "validation",
  502: "network",
  503: "network",
  504: "network",
};

const FALLBACK_MESSAGE = "Something went wrong";

export function toServiceError(status: number, body: unknown): ServiceError {
  const wire = isWireError(body) ? body : {};
  const code = readCode(wire.code, status);

  return new ServiceError({
    code,
    message: wire.message ?? FALLBACK_MESSAGE,
    ...(wire.detail === undefined ? {} : { detail: wire.detail }),
    isRetryable: wire.isRetryable ?? (code === "network" || code === "unknown"),
  });
}

export function reasonOf(error: unknown, body: unknown): string | undefined {
  void error;

  return isWireError(body) ? body.reason : undefined;
}

export function transportError(detail: string): AppError {
  return appError("network", "Could not reach the workspace service", {
    detail,
  });
}

function readCode(raw: string | undefined, status: number): AppErrorCode {
  if (raw !== undefined && KNOWN_CODES.has(raw as AppErrorCode)) {
    return raw as AppErrorCode;
  }

  return CODE_BY_STATUS[status] ?? "unknown";
}

function isWireError(body: unknown): body is WireError {
  return typeof body === "object" && body !== null;
}
