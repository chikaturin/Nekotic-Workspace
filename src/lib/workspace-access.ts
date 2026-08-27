import { slugify, uniqueSlug } from "@/lib/utils";
import type { UserSummary, Workspace, WorkspaceMember, WorkspaceRole } from "@/types";

/**
 * Workspace membership: the outermost gate (SY-WSA).
 *
 * Before any question about a folder, a board or a role, there is one that
 * comes first — *are you in this workspace at all*. Everything here answers
 * that, and nothing here reads the drive tree: a workspace you are not a member
 * of has no tree as far as you are concerned.
 *
 * The rule this file exists to stop is the quiet one: falling back to the
 * lowest role for somebody who holds no role. "Not a member" is not "viewer".
 */

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

/** The role held, or null — never a default. A default here is a way in. */
export function memberRoleOf(
  workspace: Workspace | null | undefined,
  userId: string,
): WorkspaceRole | null {
  return memberOf(workspace, userId)?.role ?? null;
}

/**
 * The workspaces this person is in.
 *
 * What the switcher lists, and the only list any surface should read. Hiding
 * rows from a full list in the component would leave every other consumer —
 * a URL, a keyboard shortcut, a stale link — reading the full one.
 */
export function visibleWorkspaces(
  workspaces: readonly Workspace[],
  userId: string,
): readonly Workspace[] {
  return workspaces.filter((workspace) => isWorkspaceMember(workspace, userId));
}

export interface WorkspaceAccess {
  readonly workspace: Workspace | null;
  /** True only when the workspace exists *and* this person is in it. */
  readonly isAllowed: boolean;
  /** Their role, or null when they hold none. */
  readonly role: WorkspaceRole | null;
}

/**
 * Resolve one workspace for one person.
 *
 * A workspace that does not exist and one the person is not in return the same
 * shape on purpose: the surface shows the same screen either way, so the URL
 * cannot be used to learn which workspaces exist.
 */
export function workspaceAccess(
  workspaces: readonly Workspace[],
  workspaceId: string | null,
  userId: string,
): WorkspaceAccess {
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
  const role = memberRoleOf(workspace, userId);

  return { workspace, isAllowed: workspace !== null && role !== null, role };
}

/* ------------------------------------------------------------- last admin */

export function adminsOf(workspace: Workspace): readonly WorkspaceMember[] {
  return workspace.members.filter((member) => member.role === "admin");
}

/** True when removing this person would leave the workspace unadministered. */
export function isLastAdmin(workspace: Workspace, userId: string): boolean {
  const admins = adminsOf(workspace);
  return admins.length === 1 && admins[0]?.id === userId;
}

export interface MembershipVerdict {
  readonly isAllowed: boolean;
  /** Present only when refused — the sentence the dialog shows. */
  readonly reason?: string;
}

const ALLOWED: MembershipVerdict = { isAllowed: true };

/**
 * Whether somebody may walk out of a workspace.
 *
 * The last admin may not, and the refusal says what to do instead. A workspace
 * with no administrator cannot be repaired from inside it — the members who
 * are left can neither invite anyone nor promote anyone, which is a shape the
 * product should never be able to reach by accident.
 */
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

/** Same rule from the other side: an admin removing the last admin. */
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

/** Demoting the last admin is the same mistake wearing a different hat. */
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

/* ------------------------------------------------------------- creating */

/** Two letters for the switcher tile, from the name somebody actually typed. */
export function badgeFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "W";

  const letters =
    words.length === 1
      ? (words[0] ?? "").slice(0, 2)
      : `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`;

  return letters.toUpperCase();
}

/** Tiles cycle through the kind palette rather than inventing a colour. */
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

/** Reasons a name is refused, so the dialog can say so before the button. */
export function validateWorkspaceName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Give the workspace a name.";
  if (trimmed.length > WORKSPACE_NAME_MAX) {
    return `Keep the name under ${WORKSPACE_NAME_MAX} characters.`;
  }
  return null;
}

const GIGABYTE = 1024 ** 3;

/**
 * A new workspace, with its creator already inside it as an admin.
 *
 * The creator's membership is part of *making* the workspace rather than a
 * step after it: a workspace whose creator has to be added afterwards has a
 * moment where nobody can administer it, and a failure in between leaves one
 * that nobody can ever administer.
 */
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

/** Add somebody, or move them to a new role if they are already in. */
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
