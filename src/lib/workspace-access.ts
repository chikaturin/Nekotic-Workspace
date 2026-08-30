import { slugify, uniqueSlug } from "@/lib/utils";
import type { UserSummary, Workspace, WorkspaceMember, WorkspaceRole } from "@/types";

export function memberOf(
  workspace: Workspace | null | undefined,
  userId: string,
): WorkspaceMember | null {
  return workspace?.members.find((member) => member.id === userId) ?? null;
}

export function isWorkspaceMember(
  workspace: Workspace | null | undefined,
  userId: string,
): boolean {
  return memberOf(workspace, userId) !== null;
}

export function memberRoleOf(
  workspace: Workspace | null | undefined,
  userId: string,
): WorkspaceRole | null {
  return memberOf(workspace, userId)?.role ?? null;
}

export function visibleWorkspaces(
  workspaces: readonly Workspace[],
  userId: string,
): readonly Workspace[] {
  return workspaces.filter((workspace) => isWorkspaceMember(workspace, userId));
}

export interface WorkspaceAccess {
  readonly workspace: Workspace | null;
  readonly isAllowed: boolean;
  readonly role: WorkspaceRole | null;
}

export function workspaceAccess(
  workspaces: readonly Workspace[],
  workspaceId: string | null,
  userId: string,
): WorkspaceAccess {
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
  const role = memberRoleOf(workspace, userId);

  return { workspace, isAllowed: workspace !== null && role !== null, role };
}

export function adminsOf(workspace: Workspace): readonly WorkspaceMember[] {
  return workspace.members.filter((member) => member.role === "admin");
}

export function isLastAdmin(workspace: Workspace, userId: string): boolean {
  const admins = adminsOf(workspace);
  return admins.length === 1 && admins[0]?.id === userId;
}

export interface MembershipVerdict {
  readonly isAllowed: boolean;
  readonly reason?: string;
}

const ALLOWED: MembershipVerdict = { isAllowed: true };

export function canLeaveWorkspace(workspace: Workspace, userId: string): MembershipVerdict {
  if (!isWorkspaceMember(workspace, userId)) {
    return { isAllowed: false, reason: "You are not a member of this workspace." };
  }

  if (isLastAdmin(workspace, userId)) {
    return {
      isAllowed: false,
      reason: `You are the only admin of ${workspace.name}. Make somebody else an admin first, or delete the workspace.`,
    };
  }

  return ALLOWED;
}

export function canRemoveMember(
  workspace: Workspace,
  actorId: string,
  targetId: string,
): MembershipVerdict {
  if (actorId === targetId) {
    return {
      isAllowed: false,
      reason: "Use Leave workspace to take yourself out — removing is for other people.",
    };
  }

  if (!isWorkspaceMember(workspace, targetId)) {
    return { isAllowed: false, reason: "They are not a member of this workspace." };
  }

  if (isLastAdmin(workspace, targetId)) {
    return {
      isAllowed: false,
      reason: `${workspace.name} would have no admin left. Make somebody else an admin first.`,
    };
  }

  return ALLOWED;
}

export function canChangeRole(
  workspace: Workspace,
  targetId: string,
  role: WorkspaceRole,
): MembershipVerdict {
  if (role !== "admin" && isLastAdmin(workspace, targetId)) {
    return {
      isAllowed: false,
      reason: `${workspace.name} would have no admin left. Promote somebody else first.`,
    };
  }

  return ALLOWED;
}

export function badgeFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "W";

  const letters =
    words.length === 1
      ? (words[0] ?? "").slice(0, 2)
      : `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`;

  return letters.toUpperCase();
}

const TILE_COLORS: readonly string[] = [
  "var(--accent)",
  "var(--kind-image)",
  "var(--kind-spreadsheet)",
  "var(--kind-board)",
  "var(--kind-video)",
  "var(--kind-archive)",
];

export interface NewWorkspaceInput {
  readonly name: string;
  readonly description?: string;
  readonly badge?: string;
  readonly color?: string;
}

export const WORKSPACE_NAME_MAX = 60;
export const WORKSPACE_DESCRIPTION_MAX = 280;

export function validateWorkspaceName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Give the workspace a name.";
  if (trimmed.length > WORKSPACE_NAME_MAX) {
    return `Keep the name under ${WORKSPACE_NAME_MAX} characters.`;
  }
  return null;
}

const GIGABYTE = 1024 ** 3;

export function makeWorkspace(
  input: NewWorkspaceInput,
  creator: UserSummary,
  { id, slugsTaken, joinedAt }: {
    readonly id: string;
    readonly slugsTaken: readonly string[];
    readonly joinedAt: string;
  },
): Workspace {
  const name = input.name.trim();

  return {
    id,
    name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    slug: uniqueSlug(slugify(name), slugsTaken),
    plan: "free",
    badge: input.badge?.trim() ? input.badge.trim().slice(0, 2).toUpperCase() : badgeFor(name),
    color: input.color ?? TILE_COLORS[slugsTaken.length % TILE_COLORS.length] ?? "var(--accent)",
    members: [{ ...creator, role: "admin", joinedAt }],
    storage: { usedBytes: 0, totalBytes: 15 * GIGABYTE },
  };
}

export function withMember(
  workspace: Workspace,
  user: UserSummary,
  role: WorkspaceRole,
  joinedAt: string,
): Workspace {
  const existing = memberOf(workspace, user.id);

  const members = existing
    ? workspace.members.map((member) =>
        member.id === user.id ? { ...member, role } : member,
      )
    : [...workspace.members, { ...user, role, joinedAt }];

  return { ...workspace, members };
}

export function withoutMember(workspace: Workspace, userId: string): Workspace {
  return { ...workspace, members: workspace.members.filter((member) => member.id !== userId) };
}
