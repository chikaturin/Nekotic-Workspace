import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { API_BASE_URL } from "@/config/api";
import { isServiceError, toAppError } from "@/services/errors";
import {
  clearAccessToken,
  getAccessToken,
  onAccessTokenChange,
  setAccessToken,
} from "@/services/http/access-token";
import { apiFetch, refreshAccessToken } from "@/services/http/client";

/**
 * Tầng HTTP nối FE với backend thật.
 *
 * Ba tính chất được kiểm ở đây vì cả ba đều hỏng một cách IM LẶNG:
 * cookie refresh không được gửi (phiên chết sau 15 phút), refresh chạy song
 * song (token xoay vòng bị coi là dùng lại và cả phiên bị thu hồi), và envelope
 * lỗi không được bóc (UI hiện "Something went wrong" cho mọi thứ).
 */

interface FakeResponse {
  readonly status: number;
  readonly body?: unknown;
  readonly text?: string;
}

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

let calls: RecordedCall[] = [];
let queue: FakeResponse[] = [];

/** `tsconfig` bật `noUncheckedIndexedAccess`; đây là chỗ khẳng định index có thật. */
const callAt = (index: number): RecordedCall => {
  const call = calls[index];

  if (call === undefined) {
    throw new Error(`Expected a request at index ${index}, saw ${calls.length}.`);
  }

  return call;
};

const headersOf = (index: number): Record<string, string> =>
  callAt(index).init.headers as Record<string, string>;

const respond = ({ status, body, text }: FakeResponse): Response => {
  const payload = text ?? (body === undefined ? "" : JSON.stringify(body));

  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(payload),
  } as unknown as Response;
};

beforeEach(() => {
  calls = [];
  queue = [];
  clearAccessToken();

  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    calls.push({ url, init });

    const next = queue.shift();

    if (next === undefined) throw new Error(`No queued response for ${url}`);

    return Promise.resolve(respond(next));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  test("prefixes the versioned base url", async () => {
    queue = [{ status: 200, body: { ok: true } }];

    await apiFetch("/me");

    expect(callAt(0).url).toBe(`${API_BASE_URL}/me`);
  });

  test("always sends credentials, so the HttpOnly refresh cookie travels", async () => {
    queue = [{ status: 200, body: {} }];

    await apiFetch("/me");

    expect(callAt(0).init.credentials).toBe("include");
  });

  test("attaches the bearer token once one is known", async () => {
    setAccessToken("token-abc");
    queue = [{ status: 200, body: {} }];

    await apiFetch("/me");

    expect(
      headersOf(0).Authorization,
    ).toBe("Bearer token-abc");
  });

  test("omits Authorization entirely when signed out", async () => {
    queue = [{ status: 200, body: {} }];

    await apiFetch("/me");

    expect(headersOf(0)).not.toHaveProperty("Authorization");
  });

  test("drops undefined query params instead of sending the string", async () => {
    queue = [{ status: 200, body: [] }];

    await apiFetch("/nodes", { query: { parentId: undefined, limit: 20 } });

    expect(callAt(0).url).toBe(`${API_BASE_URL}/nodes?limit=20`);
  });

  test("sets a JSON content type only when there is a body", async () => {
    queue = [{ status: 200, body: {} }, { status: 200, body: {} }];

    await apiFetch("/nodes", { method: "POST", body: { name: "Docs" } });
    await apiFetch("/nodes");

    expect(headersOf(0)).toHaveProperty(
      "Content-Type",
      "application/json",
    );
    expect(headersOf(1)).not.toHaveProperty("Content-Type");
  });

  test("returns undefined for a 204 without trying to parse it", async () => {
    queue = [{ status: 204 }];

    await expect(apiFetch("/nodes/n1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("error mapping", () => {
  test("unwraps the backend envelope into an AppError", async () => {
    queue = [
      {
        status: 409,
        body: {
          error: {
            code: "conflict",
            message: "This document is locked.",
            reason: "DOCUMENT_LOCKED",
            isRetryable: false,
          },
        },
      },
    ];

    const error = await apiFetch("/nodes").catch((thrown: unknown) => thrown);

    expect(isServiceError(error)).toBe(true);
    expect(toAppError(error)).toMatchObject({
      code: "conflict",
      message: "This document is locked.",
      isRetryable: false,
    });
  });

  test("honours the server's isRetryable for a 429 rather than guessing", async () => {
    // §1: `429` mang `code: "validation"` NHƯNG `isRetryable: true` — suy lại
    // từ status ở FE sẽ cho ra `false` và nút "Try again" biến mất.
    queue = [
      {
        status: 429,
        body: {
          error: {
            code: "validation",
            message: "Too many requests.",
            isRetryable: true,
            retryAfterSeconds: 42,
          },
        },
      },
    ];

    const error = await apiFetch("/auth/login").catch((thrown: unknown) => thrown);

    expect(toAppError(error)).toMatchObject({
      code: "validation",
      isRetryable: true,
    });
  });

  test("falls back to the status when a proxy answers with HTML", async () => {
    queue = [{ status: 502, text: "<html>Bad Gateway</html>" }];

    const error = await apiFetch("/me").catch((thrown: unknown) => thrown);

    expect(toAppError(error)).toMatchObject({
      code: "network",
      isRetryable: true,
    });
  });

  test("reports a transport failure as a network error, not unknown", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNREFUSED")));

    const error = await apiFetch("/me").catch((thrown: unknown) => thrown);

    expect(toAppError(error)).toMatchObject({ code: "network" });
    expect(toAppError(error).detail).toContain("ECONNREFUSED");
  });
});

describe("refresh on 401", () => {
  test("exchanges the cookie for a new token and replays the request once", async () => {
    setAccessToken("stale");
    queue = [
      { status: 401, body: { error: { code: "permission_denied" } } },
      { status: 200, body: { accessToken: "fresh" } },
      { status: 200, body: { id: "n1" } },
    ];

    await expect(apiFetch("/nodes/n1")).resolves.toEqual({ id: "n1" });

    expect(getAccessToken()).toBe("fresh");
    // Lần gọi lại mang token MỚI, không phải token đã hết hạn.
    expect(
      headersOf(2).Authorization,
    ).toBe("Bearer fresh");
  });

  test("gives up and clears the token when refresh also fails", async () => {
    setAccessToken("stale");
    queue = [
      { status: 401, body: { error: { code: "permission_denied" } } },
      { status: 401, body: { error: { code: "permission_denied" } } },
    ];

    await expect(apiFetch("/nodes/n1")).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
  });

  test("never refreshes twice for concurrent 401s", async () => {
    // Refresh token XOAY VÒNG sau mỗi lần dùng (R-5). Hai lần refresh song song
    // nghĩa là cái thứ hai gửi một token đã tiêu, bị coi là dùng lại, và cả
    // phiên bị thu hồi — người dùng bị đá ra vì chính việc tải lại màn hình.
    let refreshCalls = 0;

    vi.stubGlobal("fetch", (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;

        return Promise.resolve(respond({ status: 200, body: { accessToken: "fresh" } }));
      }

      return Promise.resolve(
        respond(
          refreshCalls === 0
            ? { status: 401, body: { error: { code: "permission_denied" } } }
            : { status: 200, body: { ok: true } },
        ),
      );
    });

    setAccessToken("stale");

    await Promise.all([
      apiFetch("/a"),
      apiFetch("/b"),
      apiFetch("/c"),
      apiFetch("/d"),
    ]);

    expect(refreshCalls).toBe(1);
  });

  test("does not try to refresh the refresh call itself", async () => {
    queue = [{ status: 401, body: { error: { code: "permission_denied" } } }];

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("access token store", () => {
  test("notifies listeners on change and stops after unsubscribe", () => {
    const seen: (string | null)[] = [];
    const unsubscribe = onAccessTokenChange((token) => seen.push(token));

    setAccessToken("one");
    setAccessToken("one");
    setAccessToken("two");
    unsubscribe();
    setAccessToken("three");

    // "one" hai lần liên tiếp chỉ phát MỘT sự kiện: không có gì đổi.
    expect(seen).toEqual(["one", "two"]);
  });
});
