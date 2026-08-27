import { describe, expect, test } from "vitest";
import {
  adminsOf,
  badgeFor,
  canChangeRole,
  canLeaveWorkspace,
  canRemoveMember,
  isLastAdmin,
  isWorkspaceMember,
  makeWorkspace,
  memberRoleOf,
  validateWorkspaceName,
  visibleWorkspaces,
  withMember,
  withoutMember,
  workspaceAccess,
} from "@/lib/workspace-access";
import type { UserSummary, Workspace, WorkspaceMember, WorkspaceRole } from "@/types";

/**
 * Workspace membership — the outermost gate.
 *
 * The property under test throughout: **not a member is not a low role**. Every
 * one of these used to answer "viewer", which is read access to a tenant
 * somebody was never in.
 */

const THANH: UserSummary = { id: "usr_thanh", name: "Thanh", email: "thanh@x.io", initials: "TH" };
const NAM: UserSummary = { id: "usr_nam", name: "Nam", email: "nam@x.io", initials: "NA" };
const MINH: UserSummary = { id: "usr_minh", name: "Minh", email: "minh@x.io", initials: "MI" };

function member(user: UserSummary, role: WorkspaceRole): WorkspaceMember {
  return { ...user, role, joinedAt: "2026-01-01T00:00:00.000Z" };
}

function workspace(id: string, name: string, members: readonly WorkspaceMember[]): Workspace {
  return {
    id,
    name,
    slug: id,
    plan: "team",
    badge: "WS",
    color: "var(--accent)",
    members,
    storage: { usedBytes: 0, totalBytes: 1024 },
  };
}

const A = workspace("ws_a", "Workspace A", [member(THANH, "admin"), member(NAM, "member")]);
const B = workspace("ws_b", "Workspace B", [member(MINH, "admin")]);
const C = workspace("ws_c", "Workspace C", [member(THANH, "manager"), member(MINH, "member")]);

describe("who can see which workspace", () => {
  /** Thanh is in A and C. B belongs to somebody else and does not exist for them. */
  test("the switcher lists membership, not the tenant list", () => {
    const mine = visibleWorkspaces([A, B, C], THANH.id);

    expect(mine.map((item) => item.id)).toEqual(["ws_a", "ws_c"]);
    expect(mine.map((item) => item.name)).not.toContain("Workspace B");
  });

  test("somebody in nothing sees nothing, rather than the first one", () => {
    expect(visibleWorkspaces([A, B, C], "usr_stranger")).toHaveLength(0);
  });

  test("membership is a fact, and holding no role is not a role", () => {
    expect(isWorkspaceMember(A, NAM.id)).toBe(true);
    expect(isWorkspaceMember(B, NAM.id)).toBe(false);
    expect(memberRoleOf(B, NAM.id)).toBeNull();
  });
});

describe("opening a workspace by its URL", () => {
  test("a workspace you are not in is refused", () => {
    const access = workspaceAccess([A, B, C], "ws_b", THANH.id);

    expect(access.isAllowed).toBe(false);
    expect(access.role).toBeNull();
  });

  /**
   * A workspace that does not exist and one you are not in answer identically,
   * so a URL cannot be used to find out which workspaces are real.
   */
  test("a workspace that does not exist answers the same way", () => {
    const missing = workspaceAccess([A, B, C], "ws_invented", THANH.id);
    const forbidden = workspaceAccess([A, B, C], "ws_b", THANH.id);

    expect(missing.isAllowed).toBe(forbidden.isAllowed);
    expect(missing.role).toBe(forbidden.role);
  });

  test("one you are in comes back with the role you hold there", () => {
    expect(workspaceAccess([A, B, C], "ws_c", THANH.id)).toMatchObject({
      isAllowed: true,
      role: "manager",
    });
  });
});

describe("creating a workspace", () => {
  test("the creator is an admin of it from the first frame", () => {
    const created = makeWorkspace(
      { name: "NexDrop Development", description: "  Dev work.  " },
      THANH,
      { id: "ws_new", slugsTaken: ["nexdrop-development"], joinedAt: "2026-08-27T00:00:00.000Z" },
    );

    expect(created.members).toHaveLength(1);
    expect(created.members[0]).toMatchObject({ id: THANH.id, role: "admin" });
    expect(isWorkspaceMember(created, THANH.id)).toBe(true);
  });

  test("the slug does not collide with one already taken", () => {
    const created = makeWorkspace({ name: "Atlas" }, THANH, {
      id: "ws_new",
      slugsTaken: ["atlas"],
      joinedAt: "2026-08-27T00:00:00.000Z",
    });

    expect(created.slug).not.toBe("atlas");
  });

  test("the description is trimmed, and an empty one is not stored", () => {
    const withText = makeWorkspace({ name: "A", description: "  hi  " }, THANH, {
      id: "w1",
      slugsTaken: [],
      joinedAt: "2026-08-27T00:00:00.000Z",
    });
    const without = makeWorkspace({ name: "A", description: "   " }, THANH, {
      id: "w2",
      slugsTaken: [],
      joinedAt: "2026-08-27T00:00:00.000Z",
    });

    expect(withText.description).toBe("hi");
    expect(without.description).toBeUndefined();
  });

  test("a name is required, and a very long one is refused", () => {
    expect(validateWorkspaceName("   ")).not.toBeNull();
    expect(validateWorkspaceName("x".repeat(200))).not.toBeNull();
    expect(validateWorkspaceName("NexDrop Development")).toBeNull();
  });

  test("the tile is taken from the name", () => {
    expect(badgeFor("NexDrop Development")).toBe("ND");
    expect(badgeFor("Atlas")).toBe("AT");
    expect(badgeFor("   ")).toBe("W");
  });
});

describe("never losing the last admin", () => {
  const soleAdmin = workspace("ws_solo", "Solo", [
    member(THANH, "admin"),
    member(NAM, "manager"),
  ]);

  test("the only admin cannot walk out", () => {
    expect(isLastAdmin(soleAdmin, THANH.id)).toBe(true);
    expect(canLeaveWorkspace(soleAdmin, THANH.id).isAllowed).toBe(false);
    expect(canLeaveWorkspace(soleAdmin, THANH.id).reason).toContain("only admin");
  });

  test("the only admin cannot be removed or demoted", () => {
    expect(canRemoveMember(soleAdmin, THANH.id, THANH.id).isAllowed).toBe(false);
    expect(canChangeRole(soleAdmin, THANH.id, "manager").isAllowed).toBe(false);
    expect(canChangeRole(soleAdmin, THANH.id, "admin").isAllowed).toBe(true);
  });

  test("with a second admin, all three become possible again", () => {
    const shared = withMember(soleAdmin, NAM, "admin", "2026-01-01T00:00:00.000Z");

    expect(adminsOf(shared)).toHaveLength(2);
    expect(canLeaveWorkspace(shared, THANH.id).isAllowed).toBe(true);
    expect(canChangeRole(shared, THANH.id, "member").isAllowed).toBe(true);
  });

  /** Removing and leaving are different actions and stay different. */
  test("removing yourself is not how you leave", () => {
    const shared = withMember(soleAdmin, NAM, "admin", "2026-01-01T00:00:00.000Z");
    const verdict = canRemoveMember(shared, THANH.id, THANH.id);

    expect(verdict.isAllowed).toBe(false);
    expect(verdict.reason).toContain("Leave workspace");
  });

  test("somebody who is not a member cannot be removed", () => {
    expect(canRemoveMember(A, THANH.id, MINH.id).isAllowed).toBe(false);
  });
});

describe("membership edits", () => {
  test("adding somebody already in moves their role instead of duplicating them", () => {
    const promoted = withMember(A, NAM, "manager", "2026-08-27T00:00:00.000Z");

    expect(promoted.members).toHaveLength(2);
    expect(memberRoleOf(promoted, NAM.id)).toBe("manager");
  });

  test("removing takes the workspace away immediately", () => {
    const without = withoutMember(A, NAM.id);

    expect(isWorkspaceMember(without, NAM.id)).toBe(false);
    expect(visibleWorkspaces([without], NAM.id)).toHaveLength(0);
  });
});
