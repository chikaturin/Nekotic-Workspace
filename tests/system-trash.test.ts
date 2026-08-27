import { beforeEach, describe, expect, test } from "vitest";
import { MOCK_NOW, TRASH_RETENTION_DAYS } from "@/config/app";
import { archiveSourceOf, archivedCapabilities, inheritedArchiveOf, isArchivedNode } from "@/lib/archive";
import { capabilitiesFor } from "@/lib/permissions";
import { daysRemaining, extractTrashed, restoreTargetFor, sortTrash, untrash } from "@/lib/trash";
import { findNodeById, updateNode } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import {
  selectTrash,
  selectTrashCount,
  selectTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { isContainer, type DriveNode, type TrashEntry } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * SY-ARC-37 and SY-TRH-38 — archive and soft delete.
 *
 * The case that matters most is the one the PRD calls out: restoring an item
 * whose original folder has since been purged.
 */

const WORKSPACE_ID = "ws_test";

const tree = () => selectTree(useWorkspaceStore.getState());
const trash = () => selectTrash(useWorkspaceStore.getState());
const actions = () => useWorkspaceStore.getState();

beforeEach(() => {
  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    trashByWorkspace: { [WORKSPACE_ID]: [] },
    expandedIds: [],
    selectedIds: [],
    previewNodeId: null,
    feedback: null,
    seed: 0,
  });
});

describe("archiving", () => {
  test("a node freezes itself and everything under it", () => {
    actions().setNodeArchived(ID.backend, true);

    const backend = findNodeById(tree(), ID.backend)!;
    expect(isArchivedNode(backend)).toBe(true);

    // The child carries no flag of its own — the freeze is resolved, not copied.
    const payment = findNodeById(tree(), ID.payment)!;
    expect(isArchivedNode(payment)).toBe(false);
    expect(archiveSourceOf(tree(), ID.payment)?.id).toBe(ID.backend);
    expect(inheritedArchiveOf(tree(), ID.payment)?.id).toBe(ID.backend);
  });

  test("the node you are standing on reports itself, not an ancestor", () => {
    actions().setNodeArchived(ID.payment, true);

    expect(archiveSourceOf(tree(), ID.payment)?.id).toBe(ID.payment);
    // …but nothing above it froze it, so its own Restore button still applies.
    expect(inheritedArchiveOf(tree(), ID.payment)).toBeNull();
  });

  test("the outermost archive wins, so restoring names the right node", () => {
    actions().setNodeArchived(ID.development, true);
    actions().setNodeArchived(ID.backend, true);

    expect(archiveSourceOf(tree(), ID.payment)?.id).toBe(ID.development);
  });

  test("archiving narrows editing and never widens anything", () => {
    const node = findNodeById(tree(), ID.payment)!;
    const base = capabilitiesFor({ role: "admin", user: CURRENT_USER, node });
    const frozen = archivedCapabilities(base);

    expect(frozen.edit).toBe(false);
    expect(frozen.upload).toBe(false);
    expect(frozen.view).toBe(base.view);
    expect(frozen.manage).toBe(base.manage);
  });

  test("restoring is a no-op when nothing changed", () => {
    const before = tree();
    actions().setNodeArchived(ID.payment, false);

    expect(tree()).toBe(before);
  });
});

describe("soft delete", () => {
  test("deleting detaches the subtree and records where it came from", () => {
    actions().trashNode(ID.payment);

    expect(findNodeById(tree(), ID.payment)).toBeNull();
    expect(selectTrashCount(useWorkspaceStore.getState())).toBe(1);

    const entry = trash()[0]!;
    expect(entry.originalPath).toBe("Development / Backend");
    expect(entry.originalAncestorIds).toEqual([ID.development, ID.backend]);
    expect(entry.deletedBy.id).toBe(CURRENT_USER.id);
    // The whole subtree travels, flagged, so nothing is lost or left behind.
    expect(isContainer(entry.node) && entry.node.children).toHaveLength(2);
    expect(isContainer(entry.node) && entry.node.children.every((child) => child.isTrashed)).toBe(
      true,
    );
  });

  test("a multi-select delete is one state write, not one per item", () => {
    actions().trashNodes([ID.payment, ID.frontend]);

    expect(trash()).toHaveLength(2);
    expect(actions().feedback?.message).toBe("Moved 2 items to Trash");
  });

  test("restoring puts an item back and says where it landed", () => {
    actions().trashNode(ID.payment);
    actions().restoreNode(ID.payment);

    const restored = findNodeById(tree(), ID.payment)!;
    expect(restored.parentId).toBe(ID.backend);
    expect(restored.isTrashed).toBe(false);
    expect(actions().feedback?.message).toContain("Backend");
    expect(actions().feedback?.message).not.toContain("no longer exists");
  });

  test("an item outlives the folder it was deleted from, and is relocated on the way back", () => {
    // Delete the page, then purge the folder it lived in — the case the PRD
    // names, and the reason deleting detaches instead of flagging in place.
    actions().trashNode(ID.payment);
    actions().deleteForever(ID.backend);

    expect(findNodeById(tree(), ID.backend)).toBeNull();
    expect(trash()).toHaveLength(1);

    actions().restoreNode(ID.payment);

    const restored = findNodeById(tree(), ID.payment)!;
    expect(restored.parentId).toBe(ID.development);
    expect(actions().feedback?.message).toContain("its original folder no longer exists");
  });

  test("with every ancestor gone the item comes back at the workspace root", () => {
    actions().trashNode(ID.payment);
    actions().deleteForever(ID.development);
    actions().restoreNode(ID.payment);

    const restored = findNodeById(tree(), ID.payment)!;
    expect(restored.parentId).toBeNull();
    expect(actions().feedback?.message).toContain("Workspace");
  });

  test("purging from the bin removes it for good", () => {
    actions().trashNode(ID.payment);
    actions().deleteForever(ID.payment);

    expect(trash()).toHaveLength(0);
    expect(findNodeById(tree(), ID.payment)).toBeNull();
    expect(actions().feedback?.tone).toBe("error");
  });

  test("emptying the bin clears it in one write", () => {
    actions().trashNodes([ID.payment, ID.frontend]);
    actions().emptyTrash();

    expect(trash()).toHaveLength(0);
    expect(actions().feedback?.message).toContain("2 items");
  });
});

describe("retention", () => {
  test("counts down from the retention window and stops at due", () => {
    const daysAgo = (days: number) =>
      new Date(Date.parse(MOCK_NOW) - days * 86_400_000).toISOString();

    expect(daysRemaining(daysAgo(0), MOCK_NOW)).toBe(TRASH_RETENTION_DAYS);
    expect(daysRemaining(daysAgo(29), MOCK_NOW)).toBe(1);
    expect(daysRemaining(daysAgo(30), MOCK_NOW)).toBeNull();
    expect(daysRemaining(daysAgo(45), MOCK_NOW)).toBeNull();
    expect(daysRemaining("not a date", MOCK_NOW)).toBeNull();
  });

  test("the bin reads newest first", () => {
    const at = (deletedAt: string): TrashEntry => ({
      id: `n_${deletedAt}`,
      node: findNodeById(buildTestTree(), ID.payment)!,
      deletedAt,
      deletedBy: CURRENT_USER,
      originalAncestorIds: [],
      originalPath: "Workspace root",
    });

    const entries = [
      at("2026-08-01T00:00:00.000Z"),
      at("2026-08-20T00:00:00.000Z"),
      at("2026-08-10T00:00:00.000Z"),
    ];

    expect(sortTrash(entries).map((entry) => entry.deletedAt)).toEqual([
      "2026-08-20T00:00:00.000Z",
      "2026-08-10T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    ]);
  });
});

describe("seeded deletions", () => {
  test("items the dataset ships as deleted are moved into the bin at start-up", () => {
    const seeded = buildTestTree();
    const { tree: live, entries } = extractTrashed(seeded, (node) => ({
      deletedAt: node.updatedAt,
      deletedBy: node.owner,
    }));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.node.name).toBe("notes.md");
    expect(findNodeById(live, entries[0]!.id)).toBeNull();
    expect(entries[0]?.originalPath).toBe("Workspace root");
  });

  test("a deleted folder takes its already-deleted children with it, once", () => {
    const withNested = updateNode(buildTestTree(), ID.backend, (node) => ({
      ...node,
      isTrashed: true,
    })) as readonly DriveNode[];

    const nested = updateNode(withNested, ID.payment, (node) => ({ ...node, isTrashed: true }));
    const { entries } = extractTrashed(nested, (node) => ({
      deletedAt: node.updatedAt,
      deletedBy: node.owner,
    }));

    // Backend and the root-level notes.md — Payment travels inside Backend.
    expect(entries.map((entry) => entry.id).sort()).toEqual(
      [ID.backend, "t_notes_md"].sort(),
    );
  });
});

describe("restore targets", () => {
  test("prefer the original parent, then the deepest surviving ancestor", () => {
    const base = buildTestTree();
    const entry = {
      id: ID.payment,
      node: findNodeById(base, ID.payment)!,
      deletedAt: MOCK_NOW,
      deletedBy: CURRENT_USER,
      originalAncestorIds: [ID.development, ID.backend],
      originalPath: "Development / Backend",
    };

    expect(restoreTargetFor(base, entry)).toEqual({
      parentId: ID.backend,
      isRelocated: false,
    });

    const withoutBackend = base.map((node) =>
      node.id === ID.development && isContainer(node)
        ? { ...node, children: node.children.filter((child) => child.id !== ID.backend) }
        : node,
    );

    expect(restoreTargetFor(withoutBackend, entry)).toEqual({
      parentId: ID.development,
      isRelocated: true,
    });
  });

  test("untrash clears the flag through the whole subtree", () => {
    const source = findNodeById(buildTestTree(), ID.payment)!;
    const trashed = { ...source, isTrashed: true };
    const restored = untrash(trashed, null);

    expect(restored.isTrashed).toBe(false);
    expect(restored.parentId).toBeNull();
    expect(isContainer(restored) && restored.children.every((child) => !child.isTrashed)).toBe(true);
  });
});
