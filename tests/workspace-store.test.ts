import { beforeEach, describe, expect, test } from "vitest";
import { childCount, findNodeById, flattenTree } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import type { CompletedUpload } from "@/services/api/file.api";
import {
  selectActiveWorkspace,
  selectTrash,
  selectTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { childrenOf, isFile, type FileAsset } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE, testWorkspace } from "./helpers";
import { seedWorkspace } from "./msw/db";

const WORKSPACE_ID = "ws_test";

/**
 * Cùng một cây ở HAI chỗ: store (cache phía client) và backend giả (nguồn sự
 * thật). Chỉ nạp store thì mọi mutation đi qua API sẽ gặp một backend rỗng và
 * fail bằng 404 — thứ trước đây không xảy ra vì store tự sinh node lấy.
 */
beforeEach(() => {
  const tree = buildTestTree();

  seedWorkspace({ workspace: TEST_WORKSPACE, nodes: tree });

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: tree },
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

describe("khi chưa có workspace nào", () => {
  beforeEach(() => {
    // Đúng trạng thái của một tài khoản vừa đăng ký: có phiên, chưa có workspace.
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspaceId: "",
      treeByWorkspace: {},
      feedback: null,
    });
  });

  test("từ chối tạo thư mục bằng một câu người dùng hiểu được", async () => {
    await actions().createFolder(null, "Untitled project folder");

    const { feedback } = useWorkspaceStore.getState();

    expect(feedback?.tone).toBe("error");
    // KHÔNG được là "Cannot POST /api/v1/workspaces//nodes" — đó là câu về
    // routing của server, cho một chuyện không phải lỗi của người dùng.
    expect(feedback?.message).not.toContain("Cannot POST");
    expect(feedback?.message).toContain("workspace");
  });

  test("không đụng tới cây, và không gửi request nào", async () => {
    // MSW bật `onUnhandledRequest: "error"`, nhưng URL hỏng `/workspaces//nodes`
    // vẫn khớp pattern `/workspaces/:id/nodes`. Nên khẳng định ở đây là: cây
    // không đổi — tức là không có node nào được chèn từ một câu trả lời nào cả.
    await actions().createFolder(null, "Untitled project folder");
    await actions().createDocument(null, "Untitled", "📄");

    expect(selectTree(useWorkspaceStore.getState())).toHaveLength(0);
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

  /** Câu trả lời của bước `complete`, đúng như backend gửi về. */
  const completed = (
    name: string,
    id: string,
    extra: Partial<CompletedUpload> = {},
  ): CompletedUpload => ({
    asset: { ...asset(name, id), previewUrl: null, thumbnailUrl: null },
    node: { id: `nd_${id}`, name },
    storage: { usedBytes: 1024, totalBytes: 5 * 1024 ** 3 },
    ...extra,
  });

  test("keys the node by the SERVER's node id, not the asset id", () => {
    actions().addUploadedAsset(ID.frontend, completed("report.txt", "asset_1"));

    const children = childrenOf(findNodeById(tree(), ID.frontend)!);

    expect(children).toHaveLength(1);
    // Asset và node là hai thứ khác nhau; mọi thao tác sau đó địa chỉ theo node.
    expect(children[0]?.id).toBe("nd_asset_1");
    expect(children[0] && isFile(children[0]) && children[0].sizeBytes).toBe(1024);
  });

  test("mang theo link webp để lưới vẽ được ngay, không đợi tải lại trang", () => {
    actions().addUploadedAsset(ID.frontend, {
      ...completed("photo.png", "asset_img"),
      asset: {
        ...asset("photo.png", "asset_img"),
        thumbnailUrl: "https://api.test/images/a.thumb.webp",
        previewUrl: "https://api.test/images/a.preview.webp",
      },
    });

    const [node] = childrenOf(findNodeById(tree(), ID.frontend)!);

    expect(node && isFile(node) && node.thumbnailUrl).toBe(
      "https://api.test/images/a.thumb.webp",
    );
  });

  test("cập nhật hạn mức lưu trữ từ con số server vừa tính", () => {
    actions().addUploadedAsset(ID.frontend, {
      ...completed("report.txt", "asset_1"),
      storage: { usedBytes: 4096, totalBytes: 5 * 1024 ** 3 },
    });

    const active = useWorkspaceStore
      .getState()
      .workspaces.find((item) => item.id === useWorkspaceStore.getState().activeWorkspaceId);

    expect(active?.storage.usedBytes).toBe(4096);
  });

  test("de-duplicates slugs between two files with the same name", () => {
    actions().addUploadedAsset(ID.frontend, completed("report.txt", "asset_1"));
    actions().addUploadedAsset(ID.frontend, completed("report.txt", "asset_2"));

    const slugs = childrenOf(findNodeById(tree(), ID.frontend)!).map((node) => node.slug);

    expect(slugs).toEqual(["report-txt", "report-txt-2"]);
  });

  test("uploads to the workspace root when no folder is given", () => {
    const before = tree().length;

    actions().addUploadedAsset(null, completed("root.txt", "asset_root"));

    expect(tree()).toHaveLength(before + 1);
  });
});

describe("document nodes", () => {
  test("createDocument inserts a page and returns it", async () => {
    const created = await actions().createDocument(ID.frontend, "Release notes", "\u{1F4C4}");

    expect(created?.type).toBe("document");
    expect(created?.slug).toBe("release-notes");
    expect(childrenOf(findNodeById(tree(), ID.frontend)!)).toHaveLength(1);
  });

  test("createDocument refuses a leaf destination", async () => {
    const created = await actions().createDocument(ID.roadmap, "Nope", "\u{1F4C4}");

    expect(created).toBeNull();
    expect(actions().feedback?.tone).toBe("error");
  });

  test("applyDocumentSummary mirrors content changes onto the tree", async () => {
    const created = await actions().createDocument(ID.frontend, "Notes", "\u{1F4C4}");
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
  test("createFolder inserts an empty container", async () => {
    await actions().createFolder(ID.frontend, "Design Tokens");

    const created = childrenOf(findNodeById(tree(), ID.frontend)!)[0];

    expect(created?.name).toBe("Design Tokens");
    expect(created?.type).toBe("folder");
    expect(created?.slug).toBe("design-tokens");
  });

  test("createFolder falls back to a default name", async () => {
    await actions().createFolder(null, "   ");

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

  /**
   * The slug is what the URL addresses, and `resolvePath` takes the first
   * sibling that matches one. Two siblings sharing a slug therefore does not
   * look like a clash — it looks like the second item having vanished, with
   * every link to it silently opening the first.
   */
  test("renameNode gives the node a slug no sibling already holds", async () => {
    await actions().createFolder(ID.backend, "Reports");
    await actions().createFolder(ID.backend, "Archive");

    const [reports, archive] = childrenOf(findNodeById(tree(), ID.backend)!).filter(
      (node) => node.name === "Reports" || node.name === "Archive",
    );

    actions().renameNode(archive!.id, "Reports");

    const renamed = findNodeById(tree(), archive!.id);
    expect(renamed?.name).toBe("Reports");
    expect(renamed?.slug).toBe("reports-2");
    expect(findNodeById(tree(), reports!.id)?.slug).toBe("reports");
  });

  test("renaming a node to its own name keeps its slug", () => {
    const before = findNodeById(tree(), ID.payment)?.slug;
    actions().renameNode(ID.payment, "Payment");

    // Its own slug must not count as taken, or every rename would add a "-2".
    expect(findNodeById(tree(), ID.payment)?.slug).toBe(before);
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
    const second = testWorkspace("ws_second", "Second");
    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE, second],
      treeByWorkspace: { [WORKSPACE_ID]: buildTestTree(), ws_second: [] },
    });

    actions().expandToNode(ID.payment);
    actions().setSelection([ID.payment]);

    expect(actions().setActiveWorkspace("ws_second")).toBe(true);

    expect(selectActiveWorkspace(useWorkspaceStore.getState()).id).toBe("ws_second");
    expect(actions().selectedIds).toHaveLength(0);
    expect(actions().expandedIds).toHaveLength(0);
  });

  /**
   * The switcher only lists what somebody holds, but the switcher is not the
   * only way in — a restored session or a stale link arrives here too.
   */
  test("switching to a workspace you are not in is refused", () => {
    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE, { ...testWorkspace("ws_other", "Other"), members: [] }],
    });

    expect(actions().setActiveWorkspace("ws_other")).toBe(false);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(WORKSPACE_ID);
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

/**
 * Thanh điều hướng vẽ từ bản sao cây trong máy, nên nó có thể nói dối: mục đã
 * bị xoá hoặc bị khoá quyền ở nơi khác vẫn nằm đó, bấm vào thì ra "Item not
 * found". Phát hiện ra thì phải gỡ ngay.
 */
describe("forgetMissingNode", () => {
  test("gỡ mục mà server bảo không còn, kèm cả nhánh con", () => {
    // Arrange
    const before = flattenTree(tree()).length;
    const folder = findNodeById(tree(), ID.frontend)!;
    const inside = childrenOf(folder).length;

    // Act
    useWorkspaceStore.getState().forgetMissingNode(ID.frontend);

    // Assert
    expect(findNodeById(tree(), ID.frontend)).toBeNull();
    expect(flattenTree(tree())).toHaveLength(before - inside - 1);
  });

  test("id lạ thì không đụng gì tới cây", () => {
    const before = flattenTree(tree()).length;

    useWorkspaceStore.getState().forgetMissingNode("khong-co-that");

    expect(flattenTree(tree())).toHaveLength(before);
  });
});

/**
 * Ghim là trạng thái CHUNG của node, không phải của riêng loại "trang".
 *
 * Trước đây `isPinned` nằm trong thuộc tính của document, nên chuyển đổi
 * thuộc tính → cột trả về `EMPTY_COLUMNS` cho mọi loại khác: ghim một board sẽ
 * bị ghi đè thành `false` ngay lần lưu kế tiếp.
 */
describe("togglePinned", () => {
  test("ghim được một thư mục", async () => {
    // Arrange
    const before = findNodeById(tree(), ID.frontend)!;
    expect(before.isPinned).toBe(false);

    // Act
    useWorkspaceStore.getState().togglePinned(ID.frontend);
    await Promise.resolve();

    // Assert
    expect(findNodeById(tree(), ID.frontend)!.isPinned).toBe(true);
  });

  test("bỏ ghim thì quay lại như cũ", async () => {
    useWorkspaceStore.getState().togglePinned(ID.frontend);
    await Promise.resolve();
    useWorkspaceStore.getState().togglePinned(ID.frontend);
    await Promise.resolve();

    expect(findNodeById(tree(), ID.frontend)!.isPinned).toBe(false);
  });

  test("id lạ thì không đụng gì tới cây", () => {
    const before = flattenTree(tree()).length;

    useWorkspaceStore.getState().togglePinned("khong-co-that");

    expect(flattenTree(tree())).toHaveLength(before);
  });
});
