const DEFAULT_API_ORIGIN = "http://localhost:1133";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const API_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN,
);

export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

export const API_TIMEOUT_MS = 20_000;

export const UPLOAD_TIMEOUT_MS = 5 * 60_000;
