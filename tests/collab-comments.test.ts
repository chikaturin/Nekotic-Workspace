import { beforeEach, describe, expect, test } from "vitest";
import { buildThreads, removeComment, replaceComment, upsertComment } from "@/lib/comments";
import { refKey, rowRef } from "@/lib/entity-ref";
import {
  applyMention,
  extractMentionIds,
  findMentionQuery,
  mentionCandidates,
  mentionToken,
  parseBody,
  plainBody,
} from "@/lib/mentions";
import { CURRENT_USER, DIRECTORY, directoryAt } from "@/mock/users";
import { boardIdFor, boardService } from "@/services/board-service";
import { commentService } from "@/services/comment-service";
import { notificationService } from "@/services/notification-service";
import { watchService } from "@/services/watch-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Comment, EntityRef } from "@/types";
import { buildTestTree, ID } from "./helpers";

const WORKSPACE_ID = "ws_test";
const MAI = directoryAt(1);
const DUC = directoryAt(2);

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  commentService.reset();
  notificationService.reset();
  watchService.reset();
  boardService.reset();

  useWorkspaceStore.setState({
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

  test("choosing a candidate replaces the token and reports the caret", () => {
    const range = findMentionQuery("ping @ma", 8)!;
    const result = applyMention("ping @ma", range, MAI);

    expect(result.text).toBe(`ping ${mentionToken(MAI)} `);
    expect(result.caret).toBe(result.text.length);
    expect(extractMentionIds(result.text)).toEqual([MAI.id]);
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

    expect(await commentService.list(refKey(target))).toHaveLength(0);

    const comment = await commentService.add({ target, body: "  needs a decision  " });
    expect(comment.body).toBe("needs a decision");
    expect(comment.parentId).toBeNull();

    expect(await commentService.list(refKey(target))).toHaveLength(1);
    expect(await commentService.list("document:elsewhere")).toHaveLength(0);
  });

  test("a reply to a reply attaches to the same root", async () => {
    const target = await recordTarget();

    const root = await commentService.add({ target, body: "root" });
    const reply = await commentService.add({ target, body: "reply", parentId: root.id });
    const nested = await commentService.add({ target, body: "nested", parentId: reply.id });

    expect(reply.parentId).toBe(root.id);
    expect(nested.parentId).toBe(root.id);

    const threads = buildThreads(await commentService.list(refKey(target)));
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies).toHaveLength(2);
  });

  test("an empty comment is rejected unless it carries an attachment", async () => {
    const target = await recordTarget();

    await expect(commentService.add({ target, body: "   " })).rejects.toThrow();

    const withFile = await commentService.add({
      target,
      body: "",
      attachments: [
        { id: "att_1", name: "trace.log", mimeType: "text/plain", sizeBytes: 12, url: null },
      ],
    });

    expect(withFile.attachments).toHaveLength(1);
  });

  test("editing stamps the edited label and is refused for other authors", async () => {
    const target = await recordTarget();
    const key = refKey(target);

    const mine = await commentService.add({ target, body: "first take" });
    expect(mine.isEdited).toBe(false);

    const edited = await commentService.edit(key, mine.id, "second take");
    expect(edited.isEdited).toBe(true);
    expect(edited.body).toBe("second take");
    expect(edited.id).toBe(mine.id);

    // A seeded comment written by somebody else must not be editable.
    const theirKey = "row:brd_nd_development_backend_payment_payment_sprint:brd_nd_development_backend_payment_payment_sprint_row_4";
    await expect(commentService.edit(theirKey, "cmt_seed_1", "rewritten")).rejects.toThrow();
  });

  test("a failed post leaves nothing behind", async () => {
    const target = await recordTarget();
    setSimulation({ failSaves: true });

    await expect(commentService.add({ target, body: "anything" })).rejects.toThrow();
    expect(await commentService.list(refKey(target))).toHaveLength(0);
  });

  test("prose about failure is prose, not a failure switch", async () => {
    const target = await recordTarget();

    // The name-based simulation marker belongs on identifiers. Applied to a
    // body it would make ordinary sentences unpostable.
    const posted = await commentService.add({
      target,
      body: "The signature check is the one failing — provider failover next.",
    });

    expect(posted.body).toContain("failing");
    expect(await commentService.list(refKey(target))).toHaveLength(1);

    const edited = await commentService.edit(refKey(target), posted.id, "the test failed again");
    expect(edited.body).toBe("the test failed again");
  });
});

describe("comment fan-out", () => {
  test("a mention notifies the person named and never the author", async () => {
    const target = await recordTarget();
    const before = (await notificationService.list(CURRENT_USER.id)).length;

    await commentService.add({ target, body: `${mentionToken(MAI)} can you check this?` });

    const hers = await notificationService.list(MAI.id);
    expect(hers).toHaveLength(1);
    expect(hers[0]?.reason).toBe("mention");
    expect(hers[0]?.target?.rowId).toBe(target.rowId);
    expect(hers[0]?.isRead).toBe(false);

    // Mentioning yourself is the only way the author hears about their own post.
    expect(await notificationService.list(CURRENT_USER.id)).toHaveLength(before);
  });

  test("watchers hear about it once, and a mentioned watcher is not told twice", async () => {
    const target = await recordTarget();

    await watchService.setWatching({ ref: target, userId: DUC.id, isWatching: true });
    await watchService.setWatching({ ref: target, userId: MAI.id, isWatching: true });

    await commentService.add({ target, body: `${mentionToken(MAI)} shipping today` });

    const his = await notificationService.list(DUC.id);
    expect(his.map((item) => item.reason)).toEqual(["comment"]);

    const hers = await notificationService.list(MAI.id);
    expect(hers.map((item) => item.reason)).toEqual(["mention"]);
  });

  test("commenting starts following the target", async () => {
    const target = await recordTarget();

    expect(watchService.watchersOf(refKey(target))).not.toContain(CURRENT_USER.id);

    await commentService.add({ target, body: "picking this up" });
    expect(watchService.watchersOf(refKey(target))).toContain(CURRENT_USER.id);
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
    expect(await commentService.list(comment.targetKey)).toHaveLength(1);
  });
});
