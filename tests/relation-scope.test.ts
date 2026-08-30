import { describe, expect, test } from "vitest";
import { scopeBoardsToFolder } from "@/lib/relation-scope";
import type { DriveNode } from "@/types";

/**
 * Board nào được phép làm đích của một Relation Column.
 *
 * Đây là luật quyết định picker HIỆN cái gì, nên nó cũng là chỗ dễ rò nhất:
 * hiện nhầm một board là lộ tên board đó, kể cả khi bấm vào không mở được.
 */

const node = (
  id: string,
  type: DriveNode["type"],
  parentId: string | null,
  children: readonly DriveNode[] = [],
): DriveNode =>
  ({
    id,
    name: id,
    slug: id,
    parentId,
    workspaceId: "ws",
    owner: { id: "u1", name: "U", email: "u@x.io", initials: "U" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    isTrashed: false,
    isShared: false,
    type,
    ...(type === "folder" || type === "project" ? { children } : {}),
    ...(type === "board" ? { boardKind: "table" } : {}),
  }) as DriveNode;

/**
 * Thư mục Payment đúng như ví dụ: bốn board cạnh nhau.
 * Ngoài ra có một thư mục khác chứa một board không liên quan.
 */
const TREE: readonly DriveNode[] = [
  node("payment", "folder", null, [
    node("nd_qa", "board", "payment"),
    node("nd_bug", "board", "payment"),
    node("nd_task", "board", "payment"),
    node("nd_api", "board", "payment"),
  ]),
  node("billing", "folder", null, [node("nd_other", "board", "billing")]),
];

const board = (id: string, nodeId: string, name: string, prefix: string) => ({
  id,
  nodeId,
  name,
  rowIdPrefix: prefix,
});

const ALL = [
  board("b_qa", "nd_qa", "QA / QC", "QA"),
  board("b_bug", "nd_bug", "Bug", "BUG"),
  board("b_task", "nd_task", "Task", "TASK"),
  board("b_api", "nd_api", "API Catalogue", "API"),
  board("b_other", "nd_other", "Billing", "BIL"),
];

const scope = (over: Partial<Parameters<typeof scopeBoardsToFolder>[0]> = {}) =>
  scopeBoardsToFolder({
    boards: ALL,
    tree: TREE,
    folderId: "payment",
    currentNodeId: "nd_bug",
    ...over,
  });

describe("phạm vi thư mục", () => {
  test("chỉ board CÙNG thư mục xuất hiện", () => {
    expect(scope().map((item) => item.id)).toEqual(["b_qa", "b_task", "b_api"]);
  });

  test("board ở thư mục khác không xuất hiện", () => {
    // TEST 2 trong đề bài: board thư mục khác nằm ngoài phạm vi V1.
    expect(scope().some((item) => item.id === "b_other")).toBe(false);
  });

  test("board đang mở tự loại khỏi danh sách", () => {
    expect(scope().some((item) => item.nodeId === "nd_bug")).toBe(false);
  });

  test("nhưng self-relation bật được khi cần", () => {
    // Backend đã hỗ trợ (`relation.boardId = null` = cùng board) và đó là nền
    // của "blocked by" / "duplicate of". Đây là lựa chọn, không phải điều cấm.
    expect(scope({ allowSelf: true }).map((item) => item.id)).toContain("b_bug");
  });
});

describe("không rò board bị hạn chế", () => {
  test("thư mục không có trong cây đã lọc quyền → danh sách RỖNG", () => {
    // Người này không thấy thư mục đó. Rơi về gốc workspace sẽ biến một thư mục
    // bị hạn chế thành "chọn thoải mái toàn workspace" — đúng kiểu rò mà A14
    // cấm: lộ tên board, lộ cả sự tồn tại của nó.
    expect(scope({ folderId: "khong-thay-duoc" })).toEqual([]);
  });

  test("board server không trả về thì không có đường nào lọt vào", () => {
    // Hàng rào thật nằm ở backend; hàm này chỉ thu hẹp tiếp.
    const withoutQa = ALL.filter((item) => item.id !== "b_qa");

    expect(scope({ boards: withoutQa }).some((item) => item.id === "b_qa")).toBe(false);
  });
});

describe("board ở gốc workspace", () => {
  test("folderId null thì lấy board ở cấp cao nhất", () => {
    const flat: readonly DriveNode[] = [
      node("nd_a", "board", null),
      node("nd_b", "board", null),
    ];

    const result = scopeBoardsToFolder({
      boards: [board("b_a", "nd_a", "A", "A"), board("b_b", "nd_b", "B", "B")],
      tree: flat,
      folderId: null,
      currentNodeId: "nd_a",
    });

    expect(result.map((item) => item.id)).toEqual(["b_b"]);
  });
});
