import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { API_BASE_URL } from "@/config/api";
import { CURRENT_USER } from "@/mock/users";
import {
  clearAccessToken,
  getAccessToken,
} from "@/services/http/access-token";
import { currentUser, currentUserId, useSessionStore } from "@/store/session-store";
import { server } from "./msw/server";
import { TEST_WORKSPACE } from "./helpers";

/**
 * Phiên đăng nhập.
 *
 * Ba tính chất đáng kiểm, và cả ba đều là chỗ dễ sai một cách im lặng:
 * khôi phục sau F5 (token sống trong bộ nhớ nên nó luôn mất), "chưa đăng nhập"
 * là một câu trả lời bình thường chứ không phải lỗi, và đăng xuất phải xoá phiên
 * kể cả khi server không trả lời.
 */

const SIGNED_OUT = {
  status: "idle" as const,
  user: null,
  workspaces: [],
  activeWorkspaceId: null,
};

const meResponse = {
  user: CURRENT_USER,
  workspaces: [TEST_WORKSPACE],
  activeWorkspaceId: TEST_WORKSPACE.id,
  sessionExpiresAt: new Date(Date.now() + 900_000).toISOString(),
};

beforeEach(() => {
  useSessionStore.setState(SIGNED_OUT);
  clearAccessToken();
});

describe("restore", () => {
  test("exchanges the refresh cookie for a session", async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: "fresh",
          expiresAt: new Date().toISOString(),
        }),
      ),
      http.get(`${API_BASE_URL}/me`, () => HttpResponse.json(meResponse)),
    );

    await expect(useSessionStore.getState().restore()).resolves.toBe(true);

    const state = useSessionStore.getState();

    expect(state.status).toBe("ready");
    expect(state.user?.id).toBe(CURRENT_USER.id);
    expect(state.activeWorkspaceId).toBe(TEST_WORKSPACE.id);
    expect(getAccessToken()).toBe("fresh");
  });

  test("signed out is a normal answer, not a failure", async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(
          { error: { code: "permission_denied", message: "no session" } },
          { status: 401 },
        ),
      ),
    );

    await expect(useSessionStore.getState().restore()).resolves.toBe(false);

    expect(useSessionStore.getState().status).toBe("signed-out");
    expect(useSessionStore.getState().user).toBeNull();
  });

  test("a valid cookie with a broken /me leaves no half-session behind", async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: "fresh", expiresAt: "" }),
      ),
      http.get(`${API_BASE_URL}/me`, () => HttpResponse.error()),
    );

    await expect(useSessionStore.getState().restore()).resolves.toBe(false);

    // Token bị xoá cùng: giữ nó lại nghĩa là mọi request sau đó mang một danh
    // tính mà store nói là không tồn tại.
    expect(getAccessToken()).toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
  });

  test("does not start a second restore while one is in flight", async () => {
    let calls = 0;

    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        calls += 1;

        return HttpResponse.json({ accessToken: "fresh", expiresAt: "" });
      }),
      http.get(`${API_BASE_URL}/me`, () => HttpResponse.json(meResponse)),
    );

    const first = useSessionStore.getState().restore();
    const second = useSessionStore.getState().restore();

    await Promise.all([first, second]);

    expect(calls).toBe(1);
  });
});

describe("signOut", () => {
  test("clears the session even when the server never answers", async () => {
    useSessionStore.getState().signIn({
      user: CURRENT_USER,
      workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: TEST_WORKSPACE.id,
    });

    server.use(
      http.post(`${API_BASE_URL}/auth/logout`, () => HttpResponse.error()),
    );

    await useSessionStore.getState().signOut();

    // Người dùng đã bấm đăng xuất. Để họ lại trong trạng thái đăng nhập vì mạng
    // chập là sai hơn hẳn việc bỏ sót một lần thu hồi phía server.
    expect(useSessionStore.getState().status).toBe("signed-out");
    expect(useSessionStore.getState().user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe("reading the signed-in user", () => {
  test("currentUser throws when nobody is signed in", () => {
    // Một lần GHI không có tác giả là lỗi lập trình, không phải một trạng thái
    // cần xử lý mềm — nên nó phải nổ ra thay vì ghi một hàng vô danh.
    expect(() => currentUser()).toThrow(/No signed-in user/);
  });

  test("currentUserId answers with an empty string instead of throwing", () => {
    // Selector chạy cả lúc chưa có phiên: build tĩnh prerender, và khoảnh khắc
    // đầu tiên sau khi tải lại trang. Ném ở đó sẽ làm cả trang trắng.
    expect(currentUserId()).toBe("");
  });

  test("both agree once a session exists", () => {
    useSessionStore.getState().signIn({
      user: CURRENT_USER,
      workspaces: [],
      activeWorkspaceId: null,
    });

    expect(currentUser().id).toBe(CURRENT_USER.id);
    expect(currentUserId()).toBe(CURRENT_USER.id);
  });
});
