import { beforeEach, describe, expect, test } from "vitest";
import { buildThreads, removeComment, replaceComment, upsertComment } from "@/lib/comments";
import { isComposingKey } from "@/lib/dom/ime";
import { refKey, rowRef } from "@/lib/entity-ref";
import {
  applyMention,
  extractMentionIds,
  findMentionQuery,
  mentionCandidates,
  mentionToken,
  parseBody,
  plainBody,
  resolveMentions,
} from "@/lib/mentions";
import { CURRENT_USER, DIRECTORY, directoryAt } from "@/mock/users";
import { boardService } from "@/services/board-service";
import { boardIdFor } from "./msw/fake/board.fake";
import { commentService } from "@/services/comment-service";
import { notificationService } from "@/services/notification-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { collabFake } from "./msw/fake/collab.fake";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Comment, EntityRef } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

const WORKSPACE_ID = "ws_test";
const MAI = directoryAt(1);
const DUC = directoryAt(2);

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    feedback: null,
    seed: 0,
  });
});

async function recordTarget(): Promise<EntityRef> {
  const snapshot = await boardService.getBoard(ID.roadmap);
  const row = snapshot.rows[0]!;

  return rowRef({
    nodeId: ID.roadmap,
    boardId: boardIdFor(ID.roadmap),
    rowId: row.id,
    label: row.displayId,
  });
}

function makeComment(id: string, parentId: string | null, createdAt: string): Comment {
  return {
    id,
    targetKey: "row:b:r",
    target: { kind: "row", nodeId: "n", boardId: "b", rowId: "r", label: "TASK-001" },
    parentId,
    author: DIRECTORY[0]!,
    body: id,
    mentionedUserIds: [],
    attachments: [],
    createdAt,
    updatedAt: createdAt,
    isEdited: false,
  };
}

describe("mention parsing", () => {
  test("an @ opens a query only at a word boundary", () => {
    expect(findMentionQuery("hello @ma", 9)?.query).toBe("ma");
    expect(findMentionQuery("@ma", 3)?.query).toBe("ma");
    expect(findMentionQuery("(@ma", 4)?.query).toBe("ma");

    // An email address must never open the picker.
    expect(findMentionQuery("mail@nexdrop.io", 15)).toBeNull();
    // Nor may a finished token re-open it.
    expect(findMentionQuery(`${mentionToken(MAI)}`, 5)).toBeNull();
  });

  test("the query ends at whitespace and gives up past a sane length", () => {
    expect(findMentionQuery("ping @mai then", 9)?.query).toBe("mai");
    expect(findMentionQuery("hey @mai now", 12)).toBeNull();
    expect(findMentionQuery(`@${"x".repeat(60)}`, 61)).toBeNull();
  });

  test("chọn một người thì ô soạn thảo hiện @Tên, không phải dạng lưu trữ", () => {
    // Arrange
    const range = findMentionQuery("ping @ma", 8)!;

    // Act
    const result = applyMention("ping @ma", range, MAI);

    // Assert — người đang gõ thấy tên, không thấy uuid trong ngoặc.
    expect(result.text).toBe(`ping @${MAI.name} `);
    expect(result.caret).toBe(result.text.length);
  });

  test("gửi đi thì @Tên được dịch ngược thành dạng mang id", () => {
    const sent = resolveMentions(`ping @${MAI.name} nhé`, [MAI]);

    expect(sent).toBe(`ping ${mentionToken(MAI)} nhé`);
    expect(extractMentionIds(sent)).toEqual([MAI.id]);
  });

  test("chuỗi đã ở dạng lưu trữ thì không bị dịch hai lần", () => {
    const already = `${mentionToken(MAI)} xong`;

    expect(resolveMentions(already, [MAI])).toBe(already);
  });

  test("tên không có trong danh bạ thì để nguyên là chữ thường", () => {
    expect(resolveMentions("gửi @KhongCoAi xem", [MAI])).toBe("gửi @KhongCoAi xem");
    expect(extractMentionIds(resolveMentions("gửi @KhongCoAi xem", [MAI]))).toEqual([]);
  });

  test("hai người trùng tên thì KHÔNG nhắc ai cả", () => {
    const twin = { ...MAI, id: "usr_twin" };

    expect(resolveMentions(`@${MAI.name} ơi`, [MAI, twin])).toBe(`@${MAI.name} ơi`);
  });

  test("tên dài được ưu tiên, để tên ngắn không ăn mất phần đầu", () => {
    const short = { ...MAI, id: "usr_short", name: "Mai" };
    const long = { ...MAI, id: "usr_long", name: "Mai Anh" };

    const sent = resolveMentions("@Mai Anh xem giúp", [short, long]);

    expect(extractMentionIds(sent)).toEqual(["usr_long"]);
  });

  test("@ dính liền sau chữ thì không phải là nhắc tên", () => {
    expect(resolveMentions(`email@${MAI.name}`, [MAI])).toBe(`email@${MAI.name}`);
  });

  test("candidates match name or email, and exclude former members", () => {
    expect(mentionCandidates(DIRECTORY, "mai tran").map((person) => person.id)).toEqual([MAI.id]);
    // "gmail" contains "mai": a name query is a substring match, not a word one.
    expect(mentionCandidates(DIRECTORY, "mai").map((person) => person.id)).toContain(MAI.id);
    expect(mentionCandidates(DIRECTORY, "nexdrop.io").length).toBeGreaterThan(1);

    const inactive = DIRECTORY.filter((person) => !person.isActive);
    expect(inactive.length).toBeGreaterThan(0);
    expect(mentionCandidates(DIRECTORY, "thanh")).toHaveLength(0);
  });

  test("a body splits into text, mention and record segments", () => {
    const body = `${mentionToken(MAI)} please look at QA-128 today`;

    expect(parseBody(body)).toEqual([
      { kind: "mention", userId: MAI.id, label: MAI.name },
      { kind: "text", text: " please look at " },
      { kind: "record", displayId: "QA-128" },
      { kind: "text", text: " today" },
    ]);

    expect(plainBody(body)).toBe(`@${MAI.name} please look at QA-128 today`);
    expect(extractMentionIds(`${mentionToken(MAI)} ${mentionToken(MAI)}`)).toEqual([MAI.id]);
  });
});

describe("comment lists are idempotent", () => {
  test("upsert replaces by id instead of appending", () => {
    const first = makeComment("a", null, "2026-01-01T00:00:00.000Z");
    const list = upsertComment([], first);

    expect(upsertComment(list, first)).toHaveLength(1);
    expect(upsertComment(list, { ...first, body: "edited" })[0]?.body).toBe("edited");
  });

  test("replacing an optimistic comment converges whichever write lands first", () => {
    const optimistic = makeComment("tmp", null, "2026-01-01T00:00:00.000Z");
    const saved = makeComment("real", null, "2026-01-01T00:00:01.000Z");

    // The realtime frame arrived before the request resolved.
    const raced = upsertComment(upsertComment([], optimistic), saved);
    const settled = replaceComment(raced, "tmp", saved);

    expect(settled.map((comment) => comment.id)).toEqual(["real"]);
    expect(removeComment(settled, "missing")).toBe(settled);
  });

  test("threads keep replies under their root and promote orphans", () => {
    const threads = buildThreads([
      makeComment("root", null, "2026-01-01T00:00:00.000Z"),
      makeComment("reply", "root", "2026-01-01T00:00:02.000Z"),
      makeComment("orphan", "deleted-root", "2026-01-01T00:00:01.000Z"),
    ]);

    expect(threads.map((thread) => thread.root.id)).toEqual(["root", "orphan"]);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(["reply"]);
    expect(threads[1]?.replies).toHaveLength(0);
  });
});

describe("comment service", () => {
  test("a comment is stored against its own target only", async () => {
    const target = await recordTarget();

    expect(await commentService.list(target)).toHaveLength(0);

    const comment = await commentService.add({ target, body: "  needs a decision  " });
    expect(comment.body).toBe("needs a decision");
    expect(comment.parentId).toBeNull();

    expect(await commentService.list(target)).toHaveLength(1);
    expect(await commentService.list({ kind: "document", nodeId: "elsewhere", label: "elsewhere" })).toHaveLength(0);
  });

  test("a reply to a reply attaches to the same root", async () => {
    const target = await recordTarget();

    const root = await commentService.add({ target, body: "root" });
    const reply = await commentService.add({ target, body: "reply", parentId: root.id });
    const nested = await commentService.add({ target, body: "nested", parentId: reply.id });

    expect(reply.parentId).toBe(root.id);
    expect(nested.parentId).toBe(root.id);

    const threads = buildThreads(await commentService.list(target));
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies).toHaveLength(2);
  });

  test("an empty comment is rejected, and an attachment does not rescue it", async () => {
    const target = await recordTarget();

    await expect(commentService.add({ target, body: "   " })).rejects.toThrow();

    // Backend NHẬN `attachmentIds` nhưng chưa lưu chúng: bảng
    // `comment_attachments` chưa có endpoint nào ghi vào (01_API_SPEC.md §2.13).
    // Nên một comment rỗng kèm file vẫn là một comment rỗng — và test nói đúng
    // điều đó thay vì mô tả một hành vi hệ thống chưa làm được.
    await expect(
      commentService.add({
        target,
        body: "",
        attachments: [
          {
            id: "att_1",
            name: "trace.log",
            mimeType: "text/plain",
            sizeBytes: 12,
            url: null,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  test("editing stamps the edited label and is refused for other authors", async () => {
    const target = await recordTarget();

    const mine = await commentService.add({ target, body: "first take" });
    expect(mine.isEdited).toBe(false);

    const edited = await commentService.edit(mine.id, "second take");
    expect(edited.isEdited).toBe(true);
    expect(edited.body).toBe("second take");
    expect(edited.id).toBe(mine.id);

    // Comment do người khác viết KHÔNG sửa được — server từ chối, không phải UI ẩn nút.
    await expect(commentService.edit("cmt_seed_1", "rewritten")).rejects.toThrow();
  });

  test("prose about failure is prose, not a failure switch", async () => {
    const target = await recordTarget();

    // Bộ mô phỏng lỗi theo TÊN chỉ áp cho định danh. Áp lên nội dung thì một
    // câu bình thường sẽ không đăng được.
    const posted = await commentService.add({
      target,
      body: "The signature check is the one failing — provider failover next.",
    });

    expect(posted.body).toContain("failing");
    expect(await commentService.list(target)).toHaveLength(1);

    const edited = await commentService.edit(posted.id, "the test failed again");
    expect(edited.body).toBe("the test failed again");
  });
});

describe("comment fan-out", () => {
  test("a mention notifies the person named and never the author", async () => {
    const target = await recordTarget();
    const before = (await notificationService.list()).length;

    await commentService.add({ target, body: `${mentionToken(MAI)} can you check this?` });

    // Hộp thư của NGƯỜI KHÁC đọc thẳng từ backend giả: API không bao giờ trả về
    // thông báo của một người khác người đang đăng nhập, và đó chính là điều
    // đáng giữ. Kiểm fan-out vì thế là kiểm phía server.
    const hers = collabFake.notifications(MAI.id);
    expect(hers).toHaveLength(1);
    expect(hers[0]?.reason).toBe("mention");
    expect(hers[0]?.target?.rowId).toBe(target.rowId);
    expect(hers[0]?.isRead).toBe(false);

    // Tự nhắc mình là cách DUY NHẤT tác giả nghe về bài của chính mình.
    expect(await notificationService.list()).toHaveLength(before);
  });

  test("watchers hear about it once, and a mentioned watcher is not told twice", async () => {
    const target = await recordTarget();

    // Theo dõi hộ người khác không phải việc API cho phép; dựng trạng thái đó
    // ở phía server, đúng như nó đã có sẵn khi hai người kia tự bấm theo dõi.
    collabFake.setWatch(target, DUC.id, true);
    collabFake.setWatch(target, MAI.id, true);

    await commentService.add({ target, body: `${mentionToken(MAI)} shipping today` });

    expect(collabFake.notifications(DUC.id).map((item) => item.reason)).toEqual([
      "comment",
    ]);
    expect(collabFake.notifications(MAI.id).map((item) => item.reason)).toEqual([
      "mention",
    ]);
  });

  test("commenting starts following the target", async () => {
    const target = await recordTarget();

    const follows = () =>
      collabFake
        .watches(CURRENT_USER.id)
        .some((entry) => entry.targetKey === refKey(target));

    expect(follows()).toBe(false);

    await commentService.add({ target, body: "picking this up" });

    expect(follows()).toBe(true);
  });

  test("a comment on a record lands in the board activity", async () => {
    const target = await recordTarget();
    await commentService.add({ target, body: "blocked on the provider" });

    const activity = await boardService.listActivity(target.boardId!, target.rowId!);
    expect(activity.some((entry) => entry.kind === "commented")).toBe(true);
  });

  test("a comment on a page produces no board activity", async () => {
    const target: EntityRef = { kind: "document", nodeId: ID.spec, label: "spec.pdf" };
    const comment = await commentService.add({ target, body: "looks right" });

    expect(comment.targetKey).toBe(`document:${ID.spec}`);
    expect(await commentService.list(target)).toHaveLength(1);
  });
});

/**
 * Thông báo là chữ để ĐỌC, không phải dạng lưu trữ.
 *
 * Người dùng mở trang Notifications và thấy nguyên `@[Tên](uuid)` — id dài 36
 * ký tự nằm giữa câu.
 */
describe("thông báo hiện tên, không hiện id", () => {
  test("bỏ id, giữ lại @Tên", () => {
    const body = `${mentionToken(MAI)} xem giúp mình nhé`;

    expect(plainBody(body)).toBe(`@${MAI.name} xem giúp mình nhé`);
  });

  test("nhiều lần nhắc tên trong một câu đều được bỏ id", () => {
    const body = `${mentionToken(MAI)} và ${mentionToken(MAI)} cùng xem`;

    expect(plainBody(body)).not.toContain("](");
  });

  test("câu không có ai được nhắc thì giữ nguyên", () => {
    expect(plainBody("chỉ là một câu bình thường")).toBe("chỉ là một câu bình thường");
  });
});

/**
 * Enter gửi bình luận — nhưng KHÔNG phải lúc nào cũng vậy.
 *
 * Ba trường hợp phải chừa ra, và cả ba đều có thật:
 *   - bộ gõ tiếng Việt đang ghép chữ (Enter là để chốt chữ);
 *   - danh sách nhắc tên đang mở (Enter là để chọn người);
 *   - Shift+Enter (xuống dòng).
 *
 * Đây kiểm phần LUẬT; phần nối vào textarea được đo bằng trình duyệt thật.
 */
describe("luật phím Enter trong ô bình luận", () => {
  const shouldSend = (event: {
    key: string;
    shiftKey?: boolean;
    altKey?: boolean;
    isComposing?: boolean;
    keyCode?: number;
    isPickerOpen?: boolean;
  }): boolean => {
    if (isComposingKey(event)) return false;
    if (event.isPickerOpen === true) return false;
    return event.key === "Enter" && event.shiftKey !== true && event.altKey !== true;
  };

  test("Enter trơn thì gửi", () => {
    expect(shouldSend({ key: "Enter" })).toBe(true);
  });

  test("Shift+Enter thì xuống dòng, không gửi", () => {
    expect(shouldSend({ key: "Enter", shiftKey: true })).toBe(false);
  });

  test("bộ gõ đang ghép chữ thì không gửi", () => {
    expect(shouldSend({ key: "Enter", isComposing: true })).toBe(false);
    expect(shouldSend({ key: "Enter", keyCode: 229 })).toBe(false);
  });

  test("danh sách nhắc tên đang mở thì Enter là để chọn người", () => {
    expect(shouldSend({ key: "Enter", isPickerOpen: true })).toBe(false);
  });

  test("phím khác thì không liên quan", () => {
    expect(shouldSend({ key: "a" })).toBe(false);
  });
});
