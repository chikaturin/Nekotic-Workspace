import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { API_BASE_URL } from "@/config/api";
import { findNodeById } from "@/lib/tree";
import { folder, project } from "@/mock/factory";
import { useWorkspaceStore } from "@/store/workspace-store";
import { seedWorkspace } from "./msw/db";
import { server } from "./msw/server";
import { testWorkspace } from "./helpers";

/**
 * Mutation LẠC QUAN, server là nguồn sự thật.
 *
 * Hai nửa và cả hai đều phải kiểm: UI đổi ngay (nửa dễ), và UI quay về khi
 * server từ chối (nửa mà người ta hay quên, vì nó chỉ xảy ra khi có sự cố).
 *
 * `flush` chờ đúng vòng microtask mà `writeThrough` chạy trên đó. Không có nó
 * thì mọi assertion sẽ đọc state lạc quan và test xanh dù phần đồng bộ chưa bao
 * giờ chạy — một bộ test xanh vì lý do sai.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const WORKSPACE = testWorkspace("ws_sync");

const mountStore = (): string => {
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

  const tree = useWorkspaceStore.getState().treeByWorkspace;
  void tree;

  return WORKSPACE.id;
};

const hydrate = async (): Promise<string> => {
  const workspaceId = mountStore();

  useWorkspaceStore.setState({
    workspaces: [WORKSPACE],
    activeWorkspaceId: workspaceId,
  });

  await useWorkspaceStore.getState().hydrate(workspaceId);

  return workspaceId;
};

const nodeNamed = (name: string): string => {
  const tree =
    useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id] ?? [];
  const found = flatten(tree).find((node) => node.name === name);

  if (found === undefined) throw new Error(`No node named ${name}`);

  return found.id;
};

function flatten(nodes: readonly { id: string; name: string }[]): typeof nodes {
  return nodes.flatMap((node) =>
    "children" in node
      ? [node, ...flatten((node as { children: typeof nodes }).children)]
      : [node],
  );
}

const currentName = (nodeId: string): string | undefined =>
  findNodeById(
    useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id] ?? [],
    nodeId,
  )?.name;

describe("hydrate", () => {
  test("loads the tree from the backend into the store", async () => {
    await hydrate();

    const tree = useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id];

    expect(tree?.map((node) => node.name)).toEqual(["Development"]);
  });

  test("keeps what is on screen when the backend cannot be reached", async () => {
    await hydrate();
    server.use(
      http.get(`${API_BASE_URL}/workspaces/:workspaceId/tree`, () =>
        HttpResponse.error(),
      ),
    );

    await expect(
      useWorkspaceStore.getState().hydrate(WORKSPACE.id),
    ).resolves.toBe(false);

    // Màn hình KHÔNG bị xoá trắng vì một lần mất mạng.
    expect(
      useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id],
    ).toHaveLength(1);
  });
});

describe("renameNode", () => {
  test("shows the new name immediately and keeps it once the server agrees", async () => {
    await hydrate();
    const nodeId = nodeNamed("Backend");

    useWorkspaceStore.getState().renameNode(nodeId, "Core services");

    expect(currentName(nodeId)).toBe("Core services");

    await flush();

    expect(currentName(nodeId)).toBe("Core services");
  });

  test("reverts to the old name when the server refuses", async () => {
    await hydrate();
    const nodeId = nodeNamed("Backend");

    server.use(
      http.patch(`${API_BASE_URL}/nodes/:nodeId`, () =>
        HttpResponse.json(
          {
            error: {
              code: "conflict",
              message: "A sibling already has that name",
              isRetryable: false,
            },
          },
          { status: 409 },
        ),
      ),
    );

    useWorkspaceStore.getState().renameNode(nodeId, "Core services");
    expect(currentName(nodeId)).toBe("Core services");

    await flush();

    expect(currentName(nodeId)).toBe("Backend");
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
    expect(useWorkspaceStore.getState().feedback?.message).toContain(
      "A sibling already has that name",
    );
  });

  test("takes the slug the server assigned, not the one the client guessed", async () => {
    await hydrate();
    const nodeId = nodeNamed("Backend");

    server.use(
      http.patch(`${API_BASE_URL}/nodes/:nodeId`, async ({ params, request }) => {
        const patch = (await request.json()) as { name: string };

        return HttpResponse.json({
          id: params.nodeId,
          type: "folder",
          name: patch.name,
          // Server khử trùng lặp slug; client không đoán được hậu tố này.
          slug: "core-services-2",
          parentId: null,
          workspaceId: WORKSPACE.id,
          owner: WORKSPACE.members[0],
          createdAt: "2026-08-26T09:30:00.000Z",
          updatedAt: "2026-08-26T09:30:00.000Z",
          isFavorite: false,
          isTrashed: false,
          isShared: false,
          children: [],
        });
      }),
    );

    useWorkspaceStore.getState().renameNode(nodeId, "Core services");
    await flush();

    const node = findNodeById(
      useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id] ?? [],
      nodeId,
    );

    expect(node?.slug).toBe("core-services-2");
  });
});

describe("toggleFavorite", () => {
  test("persists through the API and survives a re-read", async () => {
    await hydrate();
    const nodeId = nodeNamed("Backend");

    useWorkspaceStore.getState().toggleFavorite(nodeId);
    await flush();

    const favorites = await (
      await import("@/services/api/drive.api")
    ).driveApi.favorites(WORKSPACE.id);

    expect(favorites.map((node) => node.id)).toContain(nodeId);
  });

  test("puts the star back when the server rejects the change", async () => {
    await hydrate();
    const nodeId = nodeNamed("Backend");

    server.use(
      http.put(`${API_BASE_URL}/nodes/:nodeId/favorite`, () =>
        HttpResponse.json(
          {
            error: {
              code: "permission_denied",
              message: "Read-only access",
              isRetryable: false,
            },
          },
          { status: 403 },
        ),
      ),
    );

    useWorkspaceStore.getState().toggleFavorite(nodeId);

    expect(
      findNodeById(
        useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id] ?? [],
        nodeId,
      )?.isFavorite,
    ).toBe(true);

    await flush();

    expect(
      findNodeById(
        useWorkspaceStore.getState().treeByWorkspace[WORKSPACE.id] ?? [],
        nodeId,
      )?.isFavorite,
    ).toBe(false);
  });
});
