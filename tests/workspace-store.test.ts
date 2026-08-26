import { beforeEach, describe, expect, test } from "vitest";
import { childCount, findNodeById } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import {
  selectActiveWorkspace,
  selectTrash,
  selectTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { childrenOf, isFile, type FileAsset } from "@/types";
import { buildTestTree, ID } from "./helpers";

const WORKSPACE_ID = "ws_test";

/** Point the store at the deterministic fixture tree before every test. */
beforeEach(() => {
  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    trashByWorkspace: { [WORKSPACE_ID]: [] },
    expandedIds: [],
    selectedIds: [],
    previewNodeId: null,
    feedback: null,
    seed: 0,
    sort: { key: "name", direction: "asc" },
    viewMode: "grid",
  });
});

const tree = () => selectTree(useWorkspaceStore.getState());
const actions = () => useWorkspaceStore.getState();

describe("moveNode", () => {
  test("relocates a folder and reports success", () => {
    actions().moveNode(ID.payment, ID.frontend);

    expect(childCount(findNodeById(tree(), ID.frontend)!)).toBe(1);
    expect(actions().feedback?.tone).toBe("success");
    expect(actions().feedback?.message).toContain("Frontend");
  });

  test("surfaces an error instead of corrupting the tree on a cyclic move", () => {
    const before = tree();

    actions().moveNode(ID.backend, ID.payment);

    expect(tree()).toBe(before);
    expect(actions().feedback?.tone).toBe("error");
  });

  test("stays silent when the item is already in the target folder", () => {
    actions().moveNode(ID.payment, ID.backend);

    expect(actions().feedback).toBeNull();
  });

  test("moving to the root reparents to null", () => {
    actions().moveNode(ID.payment, null);

    expect(findNodeById(tree(), ID.payment)?.parentId).toBeNull();
  });
});

describe("addUploadedAsset", () => {
  const asset = (name: string, id: string): FileAsset => ({
    id,
    name,
    extension: name.split(".").pop() ?? "",
    mimeType: "text/plain",
    sizeBytes: 1024,
    kind: "document",
    owner: CURRENT_USER,
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
    folderId: ID.frontend,
  });

  test("inserts a file node keyed by the asset id", () => {
    actions().addUploadedAsset(ID.frontend, asset("report.txt", "asset_1"));

    const children = childrenOf(findNodeById(tree(), ID.frontend)!);

    expect(children).toHaveLength(1);
    expect(children[0]?.id).toBe("asset_1");
    expect(children[0] && isFile(children[0]) && children[0].sizeBytes).toBe(1024);
  });

  test("de-duplicates slugs between two files with the same name", () => {
    actions().addUploadedAsset(ID.frontend, asset("report.txt", "asset_1"));
    actions().addUploadedAsset(ID.frontend, asset("report.txt", "asset_2"));

    const slugs = childrenOf(findNodeById(tree(), ID.frontend)!).map((node) => node.slug);

    expect(slugs).toEqual(["report-txt", "report-txt-2"]);
  });

  test("uploads to the workspace root when no folder is given", () => {
    const before = tree().length;

    actions().addUploadedAsset(null, asset("root.txt", "asset_root"));

    expect(tree()).toHaveLength(before + 1);
  });
});

describe("document nodes", () => {
  test("createDocument inserts a page and returns it", () => {
    const created = actions().createDocument(ID.frontend, "Release notes", "\u{1F4C4}");

    expect(created?.type).toBe("document");
    expect(created?.slug).toBe("release-notes");
    expect(childrenOf(findNodeById(tree(), ID.frontend)!)).toHaveLength(1);
  });

  test("createDocument refuses a leaf destination", () => {
    const created = actions().createDocument(ID.roadmap, "Nope", "\u{1F4C4}");

    expect(created).toBeNull();
    expect(actions().feedback?.tone).toBe("error");
  });

  test("applyDocumentSummary mirrors content changes onto the tree", () => {
    const created = actions().createDocument(ID.frontend, "Notes", "\u{1F4C4}");
    if (!created) throw new Error("page not created");

    actions().applyDocumentSummary(created.id, {
      name: "Renamed notes",
      icon: "\u{1F680}",
      blockCount: 7,
      excerpt: "First line of the page",
      isPinned: true,
      isLocked: false,
      isArchived: false,
      updatedAt: "2026-08-26T10:00:00.000Z",
    });

    const node = findNodeById(tree(), created.id);
    if (!node || node.type !== "document") throw new Error("expected a document node");

    expect(node.name).toBe("Renamed notes");
    // The slug is the routing key: renaming must not break the open URL.
    expect(node.slug).toBe("notes");
    expect(node.blockCount).toBe(7);
    expect(node.isPinned).toBe(true);
  });

  test("duplicateNode copies a subtree with fresh ids", () => {
    const copy = actions().duplicateNode(ID.payment);

    expect(copy?.name).toBe("Payment (copy)");
    expect(copy?.id).not.toBe(ID.payment);
    expect(childCount(findNodeById(tree(), copy!.id)!)).toBe(childCount(findNodeById(tree(), ID.payment)!));
    expect(childrenOf(findNodeById(tree(), copy!.id)!)[0]?.id).not.toBe(
      childrenOf(findNodeById(tree(), ID.payment)!)[0]?.id,
    );
  });
});

describe("folder and item lifecycle", () => {
  test("createFolder inserts an empty container", () => {
    actions().createFolder(ID.frontend, "Design Tokens");

    const created = childrenOf(findNodeById(tree(), ID.frontend)!)[0];

    expect(created?.name).toBe("Design Tokens");
    expect(created?.type).toBe("folder");
    expect(created?.slug).toBe("design-tokens");
  });

  test("createFolder falls back to a default name", () => {
    actions().createFolder(null, "   ");

    expect(tree().some((node) => node.name === "Untitled folder")).toBe(true);
  });

  test("renameNode updates the name and the routing slug", () => {
    actions().renameNode(ID.payment, "Payments V2");

    const renamed = findNodeById(tree(), ID.payment);

    expect(renamed?.name).toBe("Payments V2");
    expect(renamed?.slug).toBe("payments-v2");
  });

  test("renameNode ignores blank input", () => {
    actions().renameNode(ID.payment, "  ");

    expect(findNodeById(tree(), ID.payment)?.name).toBe("Payment");
  });

  test("applyFileSave records the new size and bumps the version", () => {
    const before = findNodeById(tree(), ID.spec);
    const baseVersion = before && isFile(before) ? before.version : 0;

    actions().applyFileSave(ID.spec, 4_096);

    const after = findNodeById(tree(), ID.spec);

    expect(after && isFile(after) && after.sizeBytes).toBe(4_096);
    expect(after && isFile(after) && after.version).toBe(baseVersion + 1);
  });

  test("applyFileSave leaves folders untouched", () => {
    actions().applyFileSave(ID.payment, 4_096);

    expect(findNodeById(tree(), ID.payment)?.type).toBe("folder");
  });

  test("trashNode detaches the node into the bin and drops it from the selection", () => {
    actions().setSelection([ID.payment]);

    actions().trashNode(ID.payment);

    // Deleting detaches: the node leaves the tree entirely rather than staying
    // in place behind a flag, which is what lets it outlive its parent.
    expect(findNodeById(tree(), ID.payment)).toBeNull();
    expect(selectTrash(actions())).toHaveLength(1);
    expect(selectTrash(actions())[0]?.node.isTrashed).toBe(true);
    expect(actions().selectedIds).toHaveLength(0);
  });

  test("restoreNode puts the node back where it came from", () => {
    actions().trashNode(ID.payment);
    actions().restoreNode(ID.payment);

    expect(findNodeById(tree(), ID.payment)?.isTrashed).toBe(false);
    expect(findNodeById(tree(), ID.payment)?.parentId).toBe(ID.backend);
    expect(selectTrash(actions())).toHaveLength(0);
  });

  test("deleteForever removes the node from the tree", () => {
    actions().deleteForever(ID.payment);

    expect(findNodeById(tree(), ID.payment)).toBeNull();
  });

  test("toggleFavorite flips both ways with matching feedback", () => {
    actions().toggleFavorite(ID.frontend);
    expect(findNodeById(tree(), ID.frontend)?.isFavorite).toBe(true);
    expect(actions().feedback?.message).toContain("Added");

    actions().toggleFavorite(ID.frontend);
    expect(findNodeById(tree(), ID.frontend)?.isFavorite).toBe(false);
    expect(actions().feedback?.message).toContain("Removed");
  });
});

describe("view state", () => {
  test("toggleExpanded adds then removes an id", () => {
    actions().toggleExpanded(ID.backend);
    expect(actions().expandedIds).toContain(ID.backend);

    actions().toggleExpanded(ID.backend);
    expect(actions().expandedIds).not.toContain(ID.backend);
  });

  test("expandToNode opens every ancestor but not the node itself", () => {
    actions().expandToNode(ID.payment);

    expect(actions().expandedIds).toEqual([ID.development, ID.backend]);
  });

  test("collapseAll clears the open set", () => {
    actions().expandToNode(ID.payment);
    actions().collapseAll();

    expect(actions().expandedIds).toHaveLength(0);
  });

  test("plain selection replaces, additive selection accumulates", () => {
    actions().toggleSelection(ID.payment, false);
    actions().toggleSelection(ID.frontend, false);
    expect(actions().selectedIds).toEqual([ID.frontend]);

    actions().toggleSelection(ID.payment, true);
    expect(actions().selectedIds).toHaveLength(2);

    actions().toggleSelection(ID.payment, true);
    expect(actions().selectedIds).toEqual([ID.frontend]);
  });

  test("switching workspace resets navigation state", () => {
    actions().expandToNode(ID.payment);
    actions().setSelection([ID.payment]);

    actions().setActiveWorkspace("ws_nexdrop");

    expect(selectActiveWorkspace(useWorkspaceStore.getState()).id).toBe("ws_nexdrop");
    expect(actions().selectedIds).toHaveLength(0);
    expect(actions().expandedIds).toHaveLength(0);
  });

  test("preview and sidebar toggles round-trip", () => {
    actions().openPreview(ID.spec);
    expect(actions().previewNodeId).toBe(ID.spec);

    actions().closePreview();
    expect(actions().previewNodeId).toBeNull();

    const collapsed = actions().isSidebarCollapsed;
    actions().toggleSidebar();
    expect(actions().isSidebarCollapsed).toBe(!collapsed);
  });

  test("feedback can be pushed and dismissed", () => {
    actions().pushFeedback("hello", "info");
    expect(actions().feedback?.message).toBe("hello");

    actions().dismissFeedback();
    expect(actions().feedback).toBeNull();
  });
});
