import { describe, expect, test } from "vitest";
import { flattenTree } from "@/lib/tree";
import { NEKOTIC_TREE } from "@/mock/tree";
import { CURRENT_USER } from "@/mock/users";
import { documentService, summarize } from "@/services/document-service";
import { isServiceError } from "@/services/errors";
import { isDocument, type Block } from "@/types";

/**
 * `documentService` giờ là một CLIENT: nó nói HTTP với backend, và trong test
 * backend đó là handler MSW đứng trên `document.fake`.
 *
 * Điều đáng kiểm vì thế đã đổi. Trước đây là "kho trong bộ nhớ có đúng không";
 * bây giờ là "service có gọi đúng endpoint, gửi đúng payload và xử lý đúng câu
 * trả lời không" — kể cả khi câu trả lời là một lỗi.
 */

function nodeIdByName(name: string): string {
  const node = flattenTree(NEKOTIC_TREE).find(
    (candidate) => candidate.name === name,
  );

  if (!node || !isDocument(node)) throw new Error(`no document named ${name}`);

  return node.id;
}

const NOTES = nodeIdByName("Payment Integration Notes");
const LOCKED = nodeIdByName("Component Review");

const draft = (
  blocks: readonly Block[],
  title = "Payment Integration Notes",
) => ({ title, icon: "💳", blocks });

describe("get", () => {
  test("returns the seeded content for a page", async () => {
    const document = await documentService.get(NOTES);

    expect(document.title).toBe("Payment Integration Notes");
    expect(document.blocks.length).toBeGreaterThan(10);
    expect(document.version).toBe(1);
  });

  test("turns a 404 into a not_found AppError", async () => {
    await expect(documentService.get("nope")).rejects.toSatisfy(
      (error: unknown) =>
        isServiceError(error) && error.appError.code === "not_found",
    );
  });

  test("a locked page reports who locked it", async () => {
    const document = await documentService.get(LOCKED);

    expect(document.isLocked).toBe(true);
    expect(document.lockedBy).not.toBeNull();
  });
});

describe("save", () => {
  test("persists blocks and bumps the version", async () => {
    const before = await documentService.get(NOTES);
    const blocks: readonly Block[] = [
      { id: "b1", type: "paragraph", text: "Rewritten" },
    ];

    const saved = await documentService.save(NOTES, draft(blocks));

    expect(saved.blocks).toHaveLength(1);
    expect(saved.version).toBe(before.version + 1);
    // Đọc lại qua HTTP: phiên bản mới phải THẬT SỰ nằm ở phía server, không chỉ
    // trong đối tượng vừa trả về.
    expect(await documentService.get(NOTES)).toMatchObject({
      version: saved.version,
    });
  });

  test("an empty title falls back to Untitled", async () => {
    expect((await documentService.save(NOTES, draft([], "   "))).title).toBe(
      "Untitled",
    );
  });

  test("refuses to write to a locked page", async () => {
    await expect(
      documentService.save(LOCKED, {
        title: "Component Review",
        icon: "🧩",
        blocks: [],
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        isServiceError(error) && error.appError.code === "conflict",
    );
  });

  test("a stale expectedVersion is refused instead of overwriting", async () => {
    // Hai tab cùng mở một trang. Không có token này thì người lưu sau thắng và
    // không ai biết bản của người kia đã biến mất.
    const before = await documentService.get(NOTES);

    await documentService.save(NOTES, draft([]), before.version);

    await expect(
      documentService.save(NOTES, draft([]), before.version),
    ).rejects.toSatisfy(
      (error: unknown) =>
        isServiceError(error) && error.appError.code === "conflict",
    );
  });
});

describe("page actions", () => {
  test("pin and unpin round-trip", async () => {
    expect((await documentService.setPinned(NOTES, true)).isPinned).toBe(true);
    expect((await documentService.setPinned(NOTES, false)).isPinned).toBe(false);
  });

  test("locking records the holder and unlocking clears it", async () => {
    // Ai khoá do SERVER ghi từ phiên đang gọi — client không gửi danh tính lên.
    const locked = await documentService.setLocked(NOTES, true);

    expect(locked.lockedBy?.id).toBe(CURRENT_USER.id);

    const unlocked = await documentService.setLocked(NOTES, false);

    expect(unlocked.isLocked).toBe(false);
    expect(unlocked.lockedBy).toBeNull();
  });

  test("creating a page is its first save, not a separate endpoint", async () => {
    await documentService.create({
      nodeId: "node_new",
      title: "Fresh page",
      icon: "📄",
      blocks: [{ id: "b", type: "paragraph", text: "" }],
    });

    expect((await documentService.get("node_new")).title).toBe("Fresh page");
  });
});

describe("versions", () => {
  test("every save adds an entry to the history", async () => {
    const before = await documentService.listVersions(NOTES);

    await documentService.save(NOTES, draft([{ id: "b", type: "paragraph", text: "one" }]));

    expect(await documentService.listVersions(NOTES)).toHaveLength(
      before.length + 1,
    );
  });

  test("history entries carry rendered lines but not raw blocks", async () => {
    // Lịch sử một trang dài có hàng chục bản; kèm nội dung đầy đủ vào danh sách
    // là tải cả cuốn sách để vẽ một cột thời gian.
    await documentService.save(NOTES, draft([{ id: "b", type: "paragraph", text: "hello" }]));

    const [newest] = await documentService.listVersions(NOTES);

    expect(newest?.lines).toContain("hello");
    expect(newest).not.toHaveProperty("blocks");
  });

  test("restoring writes forward instead of rewinding the history", async () => {
    const original = await documentService.get(NOTES);
    const [firstVersion] = await documentService.listVersions(NOTES);

    await documentService.save(NOTES, draft([{ id: "b", type: "paragraph", text: "changed" }]));

    const restored = await documentService.restoreVersion(
      NOTES,
      firstVersion!.id,
    );

    expect(restored.blocks).toHaveLength(original.blocks.length);
    // Bản khôi phục là phiên bản MỚI NHẤT, không phải một lần tua ngược.
    expect(restored.version).toBeGreaterThan(original.version + 1);
  });

  test("restoring a locked page is refused for the same reason editing is", async () => {
    const [version] = await documentService.listVersions(LOCKED);

    await expect(
      documentService.restoreVersion(LOCKED, version!.id),
    ).rejects.toSatisfy(
      (error: unknown) =>
        isServiceError(error) && error.appError.code === "conflict",
    );
  });
});

describe("summarize", () => {
  test("derives the tree-facing patch from the content", async () => {
    const document = await documentService.get(NOTES);
    const summary = summarize(document);

    expect(summary.name).toBe(document.title);
    expect(summary.blockCount).toBe(document.blocks.length);
    expect(summary.excerpt.length).toBeGreaterThan(0);
  });
});
