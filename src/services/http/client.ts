import { API_BASE_URL, API_TIMEOUT_MS } from "@/config/api";
import { cancelled, ServiceError } from "@/services/errors";
import { toServiceError, transportError } from "./api-error";
import { clearAccessToken, getAccessToken, setAccessToken } from "./access-token";

export interface ApiRequest {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly skipRefresh?: boolean;
}

const REFRESH_PATH = "/auth/refresh";

export async function apiFetch<T>(
  path: string,
  request: ApiRequest = {},
): Promise<T> {
  const response = await send(path, request);

  if (response.status === 401 && request.skipRefresh !== true) {
    const refreshed = await refreshAccessToken();

    if (refreshed) return parse<T>(await send(path, request));

    clearAccessToken();
  }

  return parse<T>(response);
}

export async function apiSend(
  path: string,
  request: ApiRequest = {},
): Promise<void> {
  await apiFetch<unknown>(path, request);
}

let refreshInFlight: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function runRefresh(): Promise<boolean> {
  try {
    const response = await send(REFRESH_PATH, {
      method: "POST",
      skipRefresh: true,
    });

    if (!response.ok) return false;

    const body = await readBody(response);
    const token = readAccessToken(body);

    if (token === null) return false;

    setAccessToken(token);

    return true;
  } catch {
    return false;
  }
}

function readAccessToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;

  const token = (body as { readonly accessToken?: unknown }).accessToken;

  return typeof token === "string" && token !== "" ? token : null;
}

async function send(path: string, request: ApiRequest): Promise<Response> {
  const token = getAccessToken();
  const hasBody = request.body !== undefined;

  const isMultipart = request.body instanceof FormData;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    request.timeoutMs ?? API_TIMEOUT_MS,
  );

  const onAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    return await fetch(`${API_BASE_URL}${path}${queryOf(request.query)}`, {
      method: request.method ?? "GET",
      credentials: "include",
      headers: {
        ...(hasBody && !isMultipart ? { "Content-Type": "application/json" } : {}),
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      },
      ...(hasBody
        ? { body: isMultipart ? (request.body as FormData) : JSON.stringify(request.body) }
        : {}),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (request.signal?.aborted === true) throw cancelled("Request");

    throw new ServiceError(
      transportError(error instanceof Error ? error.message : String(error)),
    );
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener("abort", onAbort);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const body = await readBody(response);

  if (!response.ok) {
    throw toServiceError(response.status, unwrapError(body));
  }

  return body as T;
}

function unwrapError(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "error" in body) {
    return (body as { readonly error: unknown }).error;
  }

  return body;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();

    return text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

function queryOf(
  query: ApiRequest["query"],
): string {
  if (query === undefined) return "";

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const serialised = params.toString();

  return serialised === "" ? "" : `?${serialised}`;
}
