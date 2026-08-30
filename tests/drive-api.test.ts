import { describe, expect, test } from "vitest";
import { folder, project } from "@/mock/factory";
import { driveApi } from "@/services/api/drive.api";
import { workspaceApi } from "@/services/api/workspace.api";
import { isServiceError, toAppError } from "@/services/errors";
import { seedWorkspace } from "./msw/db";
import { server } from "./msw/server";
import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { testWorkspace } from "./helpers";
import { isFolder, isProject } from "@/types";

/**
 * Lớp API của FE, chạy qua network layer THẬT (MSW chặn ở tầng fetch).
 *
 * Điều đáng kiểm không phải "handler trả về cái gì" — đó là dữ liệu do chính
 * test dựng. Điều đáng kiểm là mọi thứ NẰM GIỮA: URL được ghép đúng chưa, query
 * param có bị gửi dạng "undefined" không, envelope lỗi có được bóc thành
 * `AppError` không, và `DriveNode` mà backend trả về có khớp kiểu FE không.
 */

const WORKSPACE = testWorkspace("ws_api");

const seed = () =>
  seedWorkspace({
    workspace: WORKSPACE,
    specs: [
      project({
        name: "Development",
        color: "var(--kind-code)",
        children: [folder({ name: "Backend", children: [] })],
      }),
    ],
  });

describe("driveApi.tree", () => {
  test("returns the workspace forest with children linked", async () => {
    seed();

    const tree = await driveApi.tree(WORKSPACE.id);
    const root = tree[0];

    expect(root).toBeDefined();
    expect(isProject(root!)).toBe(true);
    expect(root!.name).toBe("Development");
    expect(isProject(root!) && isFolder(root!.children[0]!)).toBe(true);
  });

  test("answers with an empty forest for a workspace that has no nodes", async () => {
    seedWorkspace({ workspace: WORKSPACE, specs: [] });

    await expect(driveApi.tree(WORKSPACE.id)).resolves.toEqual([]);
  });
});

describe("driveApi writes", () => {
  test("creates a node and takes the server's id, not a guessed one", async () => {
    seed();

    const created = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Ảnh dự án",
      parentId: null,
    });

    // Id do server sinh. FE không được tự đặt id — hai tab tạo cùng lúc sẽ đụng.
    expect(created.id).toMatch(/^srv_/);
    expect(created.name).toBe("Ảnh dự án");

    const tree = await driveApi.tree(WORKSPACE.id);

    expect(tree.some((node) => node.id === created.id)).toBe(true);
  });

  test("renames through PATCH and the change survives a re-read", async () => {
    seed();

    const created = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Draft",
      parentId: null,
    });

    await driveApi.update(created.id, { name: "Final" });

    const { node } = await driveApi.get(created.id);

    expect(node.name).toBe("Final");
  });

  test("nests a child under the parent the caller named", async () => {
    seed();

    const parent = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Parent",
      parentId: null,
    });
    const child = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Child",
      parentId: parent.id,
    });

    const { node: reread } = await driveApi.get(parent.id);

    expect(
      isFolder(reread) && reread.children.some((item) => item.id === child.id),
    ).toBe(true);
  });

  test("trashing removes the node from the tree", async () => {
    seed();

    const created = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Temporary",
      parentId: null,
    });

    await driveApi.trash(created.id);

    const tree = await driveApi.tree(WORKSPACE.id);

    expect(tree.some((node) => node.id === created.id)).toBe(false);
  });

  test("favourite uses PUT to set and DELETE to clear", async () => {
    seed();

    const created = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Pinned",
      parentId: null,
    });

    await driveApi.favorite(created.id, true);
    expect((await driveApi.get(created.id)).node.isFavorite).toBe(true);

    await driveApi.favorite(created.id, false);
    expect((await driveApi.get(created.id)).node.isFavorite).toBe(false);
  });

  test("only favourited nodes come back from the favourites endpoint", async () => {
    seed();

    const kept = await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Kept",
      parentId: null,
    });
    await driveApi.create(WORKSPACE.id, {
      kind: "folder",
      name: "Ignored",
      parentId: null,
    });

    await driveApi.favorite(kept.id, true);

    const favorites = await driveApi.favorites(WORKSPACE.id);

    expect(favorites.map((node) => node.name)).toEqual(["Kept"]);
  });
});

describe("error handling across the wire", () => {
  test("turns a 404 envelope into a not_found AppError", async () => {
    seed();

    const error = await driveApi
      .get("does-not-exist")
      .catch((thrown: unknown) => thrown);

    expect(isServiceError(error)).toBe(true);
    expect(toAppError(error).code).toBe("not_found");
  });

  test("surfaces a 403 as permission_denied with the server's message", async () => {
    seed();
    server.use(
      http.get(`${API_BASE_URL}/workspaces/:workspaceId/tree`, () =>
        HttpResponse.json(
          {
            error: {
              code: "permission_denied",
              message: "You do not have access to this workspace",
              isRetryable: false,
            },
          },
          { status: 403 },
        ),
      ),
    );

    const error = await driveApi
      .tree(WORKSPACE.id)
      .catch((thrown: unknown) => thrown);

    expect(toAppError(error)).toMatchObject({
      code: "permission_denied",
      message: "You do not have access to this workspace",
      isRetryable: false,
    });
  });

  test("a dropped connection reads as a retryable network error", async () => {
    seed();
    server.use(
      http.get(`${API_BASE_URL}/workspaces/:workspaceId/tree`, () =>
        HttpResponse.error(),
      ),
    );

    const error = await driveApi
      .tree(WORKSPACE.id)
      .catch((thrown: unknown) => thrown);

    expect(toAppError(error)).toMatchObject({
      code: "network",
      isRetryable: true,
    });
  });
});

describe("workspaceApi", () => {
  test("lists the workspaces the backend knows about", async () => {
    seed();

    const workspaces = await workspaceApi.list();

    expect(workspaces.map((item) => item.id)).toEqual([WORKSPACE.id]);
  });

  test("reads the storage quota that drives the usage bar", async () => {
    seed();

    await expect(workspaceApi.storage(WORKSPACE.id)).resolves.toEqual(
      WORKSPACE.storage,
    );
  });
});
