import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { findNodeById } from "@/lib/tree";
import { slugify, uniqueSlug } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import { auditFake } from "../fake/audit.fake";
import { getDb } from "../db";
import type { DriveNode, NodeAccessMode, WorkspaceRole } from "@/types";

/**
 * Handler cho context `drive`.
 *
 * Mọi thao tác ghi đều trả về NODE MỚI từ "server", không phải node caller gửi
 * lên — đó là hình dạng thật của API, và một handler trả lại nguyên input sẽ
 * giấu đi mọi chỗ FE quên dùng câu trả lời của server.
 */

const url = (path: string) => `${API_BASE_URL}${path}`;

/** Thay một node trong rừng, giữ nguyên cấu trúc còn lại. */
function replaceNode(
  nodes: readonly DriveNode[],
  nodeId: string,
  update: (node: DriveNode) => DriveNode,
): readonly DriveNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return update(node);

    if ("children" in node) {
      return { ...node, children: replaceNode(node.children, nodeId, update) };
    }

    return node;
  });
}

function removeNode(
  nodes: readonly DriveNode[],
  nodeId: string,
): readonly DriveNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) =>
      "children" in node
        ? { ...node, children: removeNode(node.children, nodeId) }
        : node,
    );
}

function insertUnder(
  nodes: readonly DriveNode[],
  parentId: string | null,
  child: DriveNode,
): readonly DriveNode[] {
  if (parentId === null) return [...nodes, child];

  return nodes.map((node) => {
    if (node.id === parentId && "children" in node) {
      return { ...node, children: [...node.children, child] };
    }

    if ("children" in node) {
      return { ...node, children: insertUnder(node.children, parentId, child) };
    }

    return node;
  });
}

const workspaceOf = (nodeId: string): string | null => {
  for (const [workspaceId, nodes] of Object.entries(getDb().treeByWorkspace)) {
    if (findNodeById(nodes, nodeId) !== null) return workspaceId;
  }

  return null;
};

const notFound = () =>
  HttpResponse.json(
    { error: { code: "not_found", message: "Not found", isRetryable: false } },
    { status: 404 },
  );

/** Sáu cờ, tất cả bật: backend giả không mô hình hoá quyền — xem `db.ts`. */
const FULL_CAPABILITIES = {
  view: true,
  edit: true,
  upload: true,
  delete: true,
  share: true,
  manage: true,
} as const;

export const driveHandlers = [
  http.get(url("/workspaces/:workspaceId/tree"), ({ params }) =>
    HttpResponse.json(
      getDb().treeByWorkspace[params.workspaceId as string] ?? [],
    ),
  ),

  http.get(url("/workspaces/:workspaceId/favorites"), ({ params }) => {
    const nodes = getDb().treeByWorkspace[params.workspaceId as string] ?? [];

    return HttpResponse.json(flatten(nodes).filter((node) => node.isFavorite));
  }),

  http.get(url("/workspaces/:workspaceId/trash"), ({ params }) =>
    HttpResponse.json(
      getDb().trashByWorkspace[params.workspaceId as string] ?? [],
    ),
  ),

  // Vỏ `{ node, capabilities }` — backend gộp quyền vào cùng câu trả lời để một
  // màn hình mở node chỉ cần một request.
  http.get(url("/nodes/:nodeId"), ({ params }) => {
    const workspaceId = workspaceOf(params.nodeId as string);

    if (workspaceId === null) return notFound();

    const node = findNodeById(
      getDb().treeByWorkspace[workspaceId] ?? [],
      params.nodeId as string,
    );

    if (!node) return notFound();

    return HttpResponse.json({ node, capabilities: FULL_CAPABILITIES });
  }),

  http.post(url("/workspaces/:workspaceId/nodes"), async ({ params, request }) => {
    const workspaceId = params.workspaceId as string;
    const body = (await request.json()) as {
      kind: string;
      name: string;
      parentId: string | null;
    };

    const db = getDb();
    const nodes = db.treeByWorkspace[workspaceId] ?? [];
    const created = makeNode(workspaceId, body, siblingSlugs(nodes, body.parentId, ""));

    db.treeByWorkspace = {
      ...db.treeByWorkspace,
      [workspaceId]: insertUnder(nodes, body.parentId, created),
    };

    return HttpResponse.json(created);
  }),

  http.patch(url("/nodes/:nodeId"), async ({ params, request }) => {
    const nodeId = params.nodeId as string;
    const workspaceId = workspaceOf(nodeId);

    if (workspaceId === null) return notFound();

    const patch = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const nodes = db.treeByWorkspace[workspaceId] ?? [];
    let updated: DriveNode | null = null;

    db.treeByWorkspace = {
      ...db.treeByWorkspace,
      [workspaceId]: replaceNode(nodes, nodeId, (node) => {
        // Slug do SERVER tính, và nó khử trùng lặp giữa các anh em. Handler trả
        // lại nguyên slug cũ sẽ giấu đi việc client có đọc câu trả lời hay
        // không — đúng thứ đáng kiểm nhất ở một mutation lạc quan.
        const name = typeof patch.name === "string" ? patch.name : node.name;
        const taken = siblingSlugs(nodes, node.parentId, nodeId);

        updated = {
          ...node,
          ...patch,
          slug: uniqueSlug(slugify(name), taken),
        } as DriveNode;

        return updated;
      }),
    };

    return updated === null ? notFound() : HttpResponse.json(updated);
  }),

  http.delete(url("/nodes/:nodeId"), ({ params }) => {
    const nodeId = params.nodeId as string;
    const workspaceId = workspaceOf(nodeId);

    if (workspaceId === null) return notFound();

    const db = getDb();

    db.treeByWorkspace = {
      ...db.treeByWorkspace,
      [workspaceId]: removeNode(db.treeByWorkspace[workspaceId] ?? [], nodeId),
    };

    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * E-041 — chế độ truy cập của một node, và nó GHI XUỐNG.
   *
   * Handler này thiếu suốt một thời gian dài, và không ai nhận ra vì client
   * cũng chưa từng gọi: nút "Restricted" chỉ đổi cây trong bộ nhớ. Backend giả
   * phải giữ đúng chỗ đó thì test mới hỏi được câu "F5 xong nó còn không".
   */
  http.put(url("/nodes/:nodeId/access-mode"), async ({ params, request }) => {
    // Tên field theo ĐÚNG dây: `accessMode`. Backend giả nhận `mode` sẽ hợp
    // thức hoá lại đúng cái sai vừa sửa, và bộ offline lại xanh trong khi app
    // thật ăn 400.
    const { accessMode } = (await request.json()) as { accessMode: NodeAccessMode };
    const nodeId = params.nodeId as string;
    const workspaceId = workspaceOf(nodeId);

    if (workspaceId === null) return notFound();

    const db = getDb();
    const tree = db.treeByWorkspace[workspaceId] ?? [];

    if (findNodeById(tree, nodeId) === null) return notFound();

    let updated: DriveNode | null = null;

    db.treeByWorkspace = {
      ...db.treeByWorkspace,
      [workspaceId]: replaceNode(tree, nodeId, (node) => {
        updated = { ...node, accessMode };
        return updated;
      }),
    };

    // Trả về NODE, như backend thật — không phải một bảng quyền.
    return HttpResponse.json(updated);
  }),

  /**
   * Ghi luật truy cập cũng GHI AUDIT — như backend thật, trong cùng một lần
   * ghi. Đó là điều làm cho nhật ký kiểm toán đáng tin: nó không phụ thuộc vào
   * việc client có nhớ gọi thêm một hàm nào không.
   */
  http.put(url("/nodes/:nodeId/access-rules"), async ({ params, request }) => {
    const body = (await request.json()) as {
      subject: { kind: string; userId?: string; role?: string };
      role: string;
    };
    const nodeId = params.nodeId as string;
    const workspaceId = workspaceOf(nodeId);
    const node =
      workspaceId === null
        ? null
        : findNodeById(getDb().treeByWorkspace[workspaceId] ?? [], nodeId);

    // Nhãn NGƯỜI ĐỌC ĐƯỢC, không phải id thô: một hàng audit là thứ người ta
    // đọc khi đang truy chuyện gì đã xảy ra, và `usr_duc` không nói được gì.
    const who =
      body.subject.kind === "user"
        ? (DIRECTORY.find((person) => person.id === body.subject.userId)?.name ??
          "a member")
        : `everyone with the ${ROLE_LABELS[body.subject.role as WorkspaceRole]} role`;

    auditFake.record({
      module: "workspace",
      action: "workspace.permission.manage",
      actor: CURRENT_USER,
      severity: "warn",
      target: node?.name ?? nodeId,
      detail:
        body.role === "none"
          ? `${who} now inherits access instead of holding it here.`
          : `${who} set to ${ROLE_LABELS[body.role as WorkspaceRole]} on this item.`,
    });

    // E-042 trả về LUẬT vừa ghi.
    return HttpResponse.json({
      id: `acl_${nodeId}_${body.subject.userId ?? body.subject.role ?? "x"}`,
      nodeId,
      subject: body.subject,
      role: body.role,
      grantedAt: new Date().toISOString(),
      grantedBy: CURRENT_USER.id,
    });
  }),

  http.put(url("/nodes/:nodeId/favorite"), ({ params }) =>
    setFavorite(params.nodeId as string, true),
  ),

  http.delete(url("/nodes/:nodeId/favorite"), ({ params }) =>
    setFavorite(params.nodeId as string, false),
  ),

  http.put(url("/nodes/:nodeId/pin"), ({ params }) =>
    setPinned(params.nodeId as string, true),
  ),

  http.delete(url("/nodes/:nodeId/pin"), ({ params }) =>
    setPinned(params.nodeId as string, false),
  ),
];

/** Ghim được cho MỌI loại node, không riêng trang — xem `node-attributes.ts`. */
function setPinned(nodeId: string, isPinned: boolean): Response {
  const workspaceId = workspaceOf(nodeId);

  if (workspaceId === null) return notFound();

  const db = getDb();

  db.treeByWorkspace = {
    ...db.treeByWorkspace,
    [workspaceId]: replaceNode(
      db.treeByWorkspace[workspaceId] ?? [],
      nodeId,
      (node) => ({ ...node, isPinned }),
    ),
  };

  return new HttpResponse(null, { status: 204 });
}

function setFavorite(nodeId: string, isFavorite: boolean): Response {
  const workspaceId = workspaceOf(nodeId);

  if (workspaceId === null) return notFound();

  const db = getDb();

  db.treeByWorkspace = {
    ...db.treeByWorkspace,
    [workspaceId]: replaceNode(
      db.treeByWorkspace[workspaceId] ?? [],
      nodeId,
      (node) => ({ ...node, isFavorite }),
    ),
  };

  return new HttpResponse(null, { status: 204 });
}

/** Slug của các node cùng cha, trừ chính node đang sửa. */
function siblingSlugs(
  nodes: readonly DriveNode[],
  parentId: string | null,
  exceptId: string,
): string[] {
  const siblings =
    parentId === null
      ? nodes
      : (() => {
          const parent = findNodeById(nodes, parentId);

          return parent !== null && "children" in parent ? parent.children : [];
        })();

  return siblings
    .filter((node) => node.id !== exceptId)
    .map((node) => node.slug);
}

function flatten(nodes: readonly DriveNode[]): readonly DriveNode[] {
  return nodes.flatMap((node) =>
    "children" in node ? [node, ...flatten(node.children)] : [node],
  );
}

let sequence = 0;

/** Id do "server" sinh — KHÁC bất cứ thứ gì client có thể đoán trước. */
function makeNode(
  workspaceId: string,
  body: { kind: string; name: string; parentId: string | null },
  takenSlugs: readonly string[],
): DriveNode {
  sequence += 1;

  const now = new Date().toISOString();
  const base = {
    id: `srv_${sequence.toString(36)}`,
    name: body.name,
    slug: uniqueSlug(slugify(body.name), [...takenSlugs]),
    parentId: body.parentId,
    workspaceId,
    owner: {
      id: "u_server",
      name: "Server",
      email: "server@nekotic.test",
      initials: "SV",
    },
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
  isPinned: false,
    isTrashed: false,
    isShared: false,
  };

  if (body.kind === "project") {
    return { ...base, type: "project", status: "active", color: "var(--accent)", children: [] };
  }

  if (body.kind === "folder") return { ...base, type: "folder", children: [] };

  if (body.kind === "board") {
    return { ...base, type: "board", boardKind: "table", itemCount: 0, openCount: 0 };
  }

  return {
    ...base,
    type: "document",
    icon: "",
    blockCount: 0,
    isPinned: false,
    isLocked: false,
    isArchived: false,
    excerpt: "",
  };
}
