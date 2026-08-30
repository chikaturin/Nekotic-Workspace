import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { slugify } from "@/lib/utils";
import { CURRENT_USER } from "@/mock/users";
import type { Workspace, WorkspaceMember } from "@/types";
import { getDb } from "../db";

const url = (path: string) => `${API_BASE_URL}${path}`;

/** Mốc thời gian cố định — test so ngày tháng thì không được phụ thuộc đồng hồ. */
const NOW = "2026-01-01T00:00:00.000Z";

const findWorkspace = (workspaceId: string): Workspace | undefined =>
  getDb().workspaces.find((entry) => entry.id === workspaceId);

/** Thay cả row, không sửa tại chỗ — `Workspace` là readonly có chủ đích. */
function writeMembers(
  workspace: Workspace,
  members: readonly WorkspaceMember[],
): void {
  const db = getDb();

  db.workspaces = db.workspaces.map((entry) =>
    entry.id === workspace.id ? { ...entry, members } : entry,
  );
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Context `workspaces` — chỉ những endpoint mà shell thật sự gọi. */
export const workspaceHandlers = [
  http.get(url("/workspaces"), () => HttpResponse.json(getDb().workspaces)),

  /**
   * Tạo workspace — SERVER đặt id, slug và gán người tạo làm admin.
   *
   * Ba thứ đó cố tình không nhận từ body: một client tự khai mình là admin của
   * thứ nó vừa tạo thì cũng tự khai được cho thứ nó không tạo.
   */
  http.post(url("/workspaces"), async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      description?: string;
    };

    const db = getDb();
    const id = `ws_${(db.workspaces.length + 1).toString(36)}`;
    const workspace: Workspace = {
      id,
      name: body.name,
      slug: slugify(body.name),
      plan: "free",
      badge: body.name.slice(0, 2).toUpperCase(),
      color: "var(--kind-other)",
      members: [{ ...CURRENT_USER, role: "admin", joinedAt: NOW }],
      storage: { usedBytes: 0, totalBytes: 5 * 1024 ** 3 },
      ...(body.description === undefined ? {} : { description: body.description }),
    };

    db.workspaces.push(workspace);
    db.treeByWorkspace[id] = [];
    db.trashByWorkspace[id] = [];

    return HttpResponse.json(workspace);
  }),

  http.get(url("/workspaces/:workspaceId"), ({ params }) => {
    const workspace = getDb().workspaces.find(
      (item) => item.id === params.workspaceId,
    );

    return workspace === undefined
      ? HttpResponse.json(
          {
            error: {
              code: "not_found",
              message: "Workspace not found",
              isRetryable: false,
            },
          },
          { status: 404 },
        )
      : HttpResponse.json(workspace);
  }),

  http.get(url("/workspaces/:workspaceId/members"), ({ params }) => {
    const workspace = getDb().workspaces.find(
      (item) => item.id === params.workspaceId,
    );

    return HttpResponse.json(workspace?.members ?? []);
  }),

  /**
   * Lập tài khoản rồi thêm thẳng vào workspace.
   *
   * Email đã có người dùng thì TỪ CHỐI, không ghi đè: một endpoint quản trị mà
   * đặt lại được mật khẩu người khác là một endpoint chiếm được tài khoản.
   */
  http.post(url("/workspaces/:workspaceId/members/accounts"), async ({ params, request }) => {
    const body = (await request.json()) as {
      email: string;
      name: string;
      password: string;
      role: WorkspaceMember["role"];
    };

    const workspace = findWorkspace(params.workspaceId as string);
    if (!workspace) return HttpResponse.json({ error: {} }, { status: 404 });

    const taken = getDb().workspaces.some((entry) =>
      entry.members.some((member) => member.email === body.email),
    );

    if (taken) {
      return HttpResponse.json(
        { error: { code: "conflict", message: "That address already has an account." } },
        { status: 409 },
      );
    }

    const member: WorkspaceMember = {
      id: `usr_${body.email.split("@")[0]}`,
      name: body.name,
      email: body.email,
      initials: initialsOf(body.name),
      role: body.role,
      joinedAt: NOW,
    };

    writeMembers(workspace, [...workspace.members, member]);

    return HttpResponse.json(member);
  }),

  /** Lời mời KHÔNG thêm thành viên — họ vào khi bấm chấp nhận. */
  http.post(url("/workspaces/:workspaceId/members"), async ({ params, request }) => {
    const body = (await request.json()) as { email: string; role: WorkspaceMember["role"] };
    const workspace = findWorkspace(params.workspaceId as string);

    if (!workspace) return HttpResponse.json({ error: {} }, { status: 404 });

    return HttpResponse.json({
      id: `inv_${body.email}`,
      email: body.email,
      role: body.role,
      invitedAt: NOW,
      expiresAt: NOW,
    });
  }),

  http.patch(url("/workspaces/:workspaceId/members/:userId"), async ({ params, request }) => {
    const body = (await request.json()) as { role: WorkspaceMember["role"] };
    const workspace = findWorkspace(params.workspaceId as string);
    const member = workspace?.members.find((entry) => entry.id === params.userId);

    if (!workspace || !member) return HttpResponse.json({ error: {} }, { status: 404 });

    const updated: WorkspaceMember = { ...member, role: body.role };

    writeMembers(
      workspace,
      workspace.members.map((entry) => (entry.id === member.id ? updated : entry)),
    );

    return HttpResponse.json(updated);
  }),

  http.delete(url("/workspaces/:workspaceId/members/me"), ({ params }) => {
    const workspace = findWorkspace(params.workspaceId as string);
    if (!workspace) return HttpResponse.json({ error: {} }, { status: 404 });

    writeMembers(
      workspace,
      workspace.members.filter((entry) => entry.id !== CURRENT_USER.id),
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(url("/workspaces/:workspaceId/members/:userId"), ({ params }) => {
    const workspace = findWorkspace(params.workspaceId as string);
    if (!workspace) return HttpResponse.json({ error: {} }, { status: 404 });

    writeMembers(
      workspace,
      workspace.members.filter((entry) => entry.id !== params.userId),
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/workspaces/:workspaceId/storage"), ({ params }) => {
    const workspace = getDb().workspaces.find(
      (item) => item.id === params.workspaceId,
    );

    return HttpResponse.json(
      workspace?.storage ?? { usedBytes: 0, totalBytes: 0 },
    );
  }),
];
