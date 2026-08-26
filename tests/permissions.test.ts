import { describe, expect, test } from "vitest";
import {
  canToggleLock,
  capabilitiesFor,
  deniedReason,
  documentCapabilities,
} from "@/lib/permissions";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER, memberAt } from "@/mock/users";
import type { DriveNode, WorkspaceRole } from "@/types";
import { buildTestTree, ID } from "./helpers";

const tree = buildTestTree();
const node = (id: string): DriveNode => {
  const found = findNodeById(tree, id);
  if (!found) throw new Error(`fixture missing: ${id}`);
  return found;
};

const forRole = (role: WorkspaceRole) => capabilitiesFor({ role, user: CURRENT_USER });

describe("role capabilities", () => {
  test("owners and admins can manage", () => {
    expect(forRole("owner").manage).toBe(true);
    expect(forRole("admin").manage).toBe(true);
  });

  test("members can edit but not manage", () => {
    const member = forRole("member");

    expect(member.edit).toBe(true);
    expect(member.upload).toBe(true);
    expect(member.manage).toBe(false);
  });

  test("guests are read-only", () => {
    const guest = forRole("guest");

    expect(guest.view).toBe(true);
    expect(guest.edit).toBe(false);
    expect(guest.upload).toBe(false);
    expect(guest.delete).toBe(false);
  });
});

describe("node-level rules", () => {
  test("a restricted vault is invisible to everyone but its owner", () => {
    const restricted: DriveNode = { ...node(ID.payment), isRestricted: true, owner: memberAt(3) };

    const asAdmin = capabilitiesFor({ role: "admin", user: CURRENT_USER, node: restricted });
    const asOwner = capabilitiesFor({ role: "member", user: memberAt(3), node: restricted });

    expect(asAdmin.view).toBe(false);
    expect(asAdmin.edit).toBe(false);
    expect(asOwner.view).toBe(true);
  });

  test("trashed nodes cannot be edited, uploaded to or shared", () => {
    const trashed: DriveNode = { ...node(ID.payment), isTrashed: true };
    const capabilities = capabilitiesFor({ role: "owner", user: CURRENT_USER, node: trashed });

    expect(capabilities.edit).toBe(false);
    expect(capabilities.upload).toBe(false);
    expect(capabilities.share).toBe(false);
    expect(capabilities.delete).toBe(true);
  });

  test("members may only delete what they own", () => {
    const owned: DriveNode = { ...node(ID.payment), owner: CURRENT_USER };
    const foreign: DriveNode = { ...node(ID.payment), owner: memberAt(2) };

    expect(capabilitiesFor({ role: "member", user: CURRENT_USER, node: owned }).delete).toBe(true);
    expect(capabilitiesFor({ role: "member", user: CURRENT_USER, node: foreign }).delete).toBe(false);
  });

  test("admins may delete anything", () => {
    const foreign: DriveNode = { ...node(ID.payment), owner: memberAt(2) };
    expect(capabilitiesFor({ role: "admin", user: CURRENT_USER, node: foreign }).delete).toBe(true);
  });
});

describe("document capabilities", () => {
  const base = forRole("member");

  test("locking removes editing and uploading", () => {
    const locked = documentCapabilities(base, { isLocked: true, isArchived: false });

    expect(locked.edit).toBe(false);
    expect(locked.upload).toBe(false);
    expect(locked.view).toBe(true);
  });

  test("archiving removes editing too", () => {
    expect(documentCapabilities(base, { isLocked: false, isArchived: true }).edit).toBe(false);
  });

  test("an unlocked, unarchived page keeps the base capabilities", () => {
    expect(documentCapabilities(base, { isLocked: false, isArchived: false })).toBe(base);
  });

  test("the owner can always unlock, a plain member cannot", () => {
    expect(canToggleLock(base, { owner: CURRENT_USER }, CURRENT_USER)).toBe(true);
    expect(canToggleLock(base, { owner: memberAt(2) }, CURRENT_USER)).toBe(false);
    expect(canToggleLock(forRole("admin"), { owner: memberAt(2) }, CURRENT_USER)).toBe(true);
  });
});

describe("denied reason", () => {
  test("names the restricted folder", () => {
    const restricted: DriveNode = { ...node(ID.payment), isRestricted: true };
    expect(deniedReason(restricted)).toContain("Payment");
  });

  test("falls back to a generic message", () => {
    expect(deniedReason(null)).toContain("do not have permission");
  });
});
