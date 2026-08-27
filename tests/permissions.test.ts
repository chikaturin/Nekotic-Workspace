import { describe, expect, test } from "vitest";
import {
  canToggleLock,
  capabilitiesFor,
  deniedReason,
  documentCapabilities,
  resolverFor,
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

describe("capability projection", () => {
  test("admins and managers may administer an item", () => {
    expect(forRole("admin").manage).toBe(true);
    expect(forRole("manager").manage).toBe(true);
  });

  test("members edit and upload but administer nothing", () => {
    const member = forRole("member");

    expect(member.edit).toBe(true);
    expect(member.upload).toBe(true);
    expect(member.manage).toBe(false);
  });

  test("viewers are read-only", () => {
    const viewer = forRole("viewer");

    expect(viewer.view).toBe(true);
    expect(viewer.edit).toBe(false);
    expect(viewer.upload).toBe(false);
    expect(viewer.delete).toBe(false);
  });

  test("edit means the key the node actually needs", () => {
    // A board is edited by writing records; a page by writing blocks. Members
    // hold the first and not the second, and the flag follows the node.
    const board = node(ID.roadmap);
    const asMember = capabilitiesFor({ role: "member", user: memberAt(2), node: board });

    expect(asMember.edit).toBe(true);
    expect(resolverFor({ role: "member", user: memberAt(2), node: board })("document.update")).toBe(
      false,
    );
  });
});

describe("node-level rules", () => {
  /**
   * Restriction is resource *access*, and this file is about capability. The
   * two used to be one check, which meant a role could be a way past a shut
   * folder; they are now resolved separately, and `lib/permissions/visibility`
   * is what decides whether a node is reachable at all.
   */
  test("a restricted folder no longer changes what a role can do", () => {
    const restricted: DriveNode = {
      ...node(ID.payment),
      accessMode: "restricted",
      owner: memberAt(3),
    };

    const asAdmin = capabilitiesFor({ role: "admin", user: CURRENT_USER, node: restricted });

    // Whether the admin gets to *see* it is asked elsewhere, and answered no.
    expect(asAdmin.view).toBe(true);
    expect(asAdmin.edit).toBe(true);
  });

  test("trashed nodes cannot be edited, uploaded to or shared", () => {
    const trashed: DriveNode = { ...node(ID.payment), isTrashed: true };
    const capabilities = capabilitiesFor({ role: "admin", user: CURRENT_USER, node: trashed });

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

  test("ownership escalates a member, never a viewer", () => {
    const owned: DriveNode = { ...node(ID.payment), owner: CURRENT_USER };
    expect(capabilitiesFor({ role: "viewer", user: CURRENT_USER, node: owned }).delete).toBe(false);
  });

  test("managers may delete anything", () => {
    const foreign: DriveNode = { ...node(ID.payment), owner: memberAt(2) };
    expect(capabilitiesFor({ role: "manager", user: CURRENT_USER, node: foreign }).delete).toBe(true);
  });

  test("an archived ancestor freezes writes but not reads", () => {
    const frozen = { role: "admin", user: CURRENT_USER, node: node(ID.roadmap), isFrozen: true } as const;
    const resolve = resolverFor(frozen);

    expect(resolve("row.update")).toBe(false);
    expect(resolve("board.import")).toBe(false);
    expect(resolve("board.export")).toBe(true);
  });

  test("a lock stops content writes and nothing else", () => {
    const locked = { role: "admin", user: CURRENT_USER, node: node(ID.roadmap), isLocked: true } as const;
    const resolve = resolverFor(locked);

    expect(resolve("row.update")).toBe(false);
    expect(resolve("document.update")).toBe(false);
    expect(resolve("document.lock")).toBe(true);
    expect(resolve("node.share")).toBe(true);
  });
});

describe("document capabilities", () => {
  const base = forRole("manager");

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
    const asMember = resolverFor({ role: "member", user: CURRENT_USER });
    const asManager = resolverFor({ role: "manager", user: CURRENT_USER });

    expect(canToggleLock(asMember, { owner: CURRENT_USER }, CURRENT_USER)).toBe(true);
    expect(canToggleLock(asMember, { owner: memberAt(2) }, CURRENT_USER)).toBe(false);
    expect(canToggleLock(asManager, { owner: memberAt(2) }, CURRENT_USER)).toBe(true);
  });
});

describe("denied reason", () => {
  /**
   * A refusal that reads "Finance is restricted" hands the name of a private
   * folder to the one person who was told they may not have it.
   */
  test("names nothing at all", () => {
    const restricted: DriveNode = { ...node(ID.payment), accessMode: "restricted" };

    expect(deniedReason()).not.toContain(restricted.name);
    expect(deniedReason()).toContain("do not have access");
  });
});
