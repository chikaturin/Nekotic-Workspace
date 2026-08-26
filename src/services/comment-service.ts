import { refKey } from "@/lib/entity-ref";
import { extractMentionIds, plainBody } from "@/lib/mentions";
import { realtime } from "@/lib/realtime/client";
import { upsertComment } from "@/lib/comments";
import { seedComments } from "@/mock/collab";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import { nextId, nowIso, readDelay, writeDelay } from "@/services/backend";
import { boardService } from "@/services/board-service";
import { appError, notFound, permissionDenied, ServiceError } from "@/services/errors";
import { notificationService } from "@/services/notification-service";
import { shouldFailWrite } from "@/services/simulation";
import { watchService } from "@/services/watch-service";
import type { Comment, CommentAttachment, DirectoryUser, EntityRef } from "@/types";

/**
 * Comments (CO-CMT-26) for every target kind.
 *
 * One store, keyed by `refKey`, so a record and a page share the same thread
 * model, the same reply rules and the same mention fan-out. Posting is also
 * the only place a notification is created for collaboration, which is what
 * keeps the inbox consistent with what was actually said.
 */

/** Preview length of a comment body inside a notification. */
const PREVIEW_LENGTH = 140;

let store: Map<string, Comment[]> | null = null;

function catalog(): Map<string, Comment[]> {
  if (!store) store = seedComments();
  return store;
}

function bucket(targetKey: string): Comment[] {
  const existing = catalog().get(targetKey);
  if (existing) return existing;

  const created: Comment[] = [];
  catalog().set(targetKey, created);
  return created;
}

function currentAuthor(): DirectoryUser {
  return DIRECTORY.find((person) => person.id === CURRENT_USER.id) ?? DIRECTORY[0]!;
}

function preview(body: string): string {
  const flat = plainBody(body).replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat;
}

/* -------------------------------------------------------------------- read */

async function list(targetKey: string, signal?: AbortSignal): Promise<readonly Comment[]> {
  await readDelay(signal);
  return [...bucket(targetKey)];
}

/** Comment count per target, for the badge next to a drawer section. */
function countFor(targetKey: string): number {
  return catalog().get(targetKey)?.length ?? 0;
}

/** Every comment that mentions a user — the "Mentioned" widget of My Work. */
function listMentioning(userId: string): readonly Comment[] {
  const hits: Comment[] = [];

  for (const comments of catalog().values()) {
    for (const comment of comments) {
      if (comment.mentionedUserIds.includes(userId)) hits.push(comment);
    }
  }

  return hits.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Flat scan for global search. Synchronous: it runs inside one search call. */
function scan(): readonly Comment[] {
  return [...catalog().values()].flat();
}

/* ------------------------------------------------------------------- write */

export interface AddCommentInput {
  readonly target: EntityRef;
  readonly body: string;
  /** Root being replied to; replies never nest more than one level. */
  readonly parentId?: string | null;
  readonly attachments?: readonly CommentAttachment[];
}

/**
 * Post a comment or a reply.
 *
 * Beyond storing it, this is the one place that fans out: the author starts
 * watching the target, mentioned people get a `mention` notification, and the
 * remaining watchers get a `comment` one. A record target also gains an
 * activity entry, so the drawer's two panels never disagree.
 */
async function add(
  { target, body, parentId = null, attachments = [] }: AddCommentInput,
  signal?: AbortSignal,
): Promise<Comment> {
  await writeDelay(signal);

  const trimmed = body.trim();
  if (trimmed.length === 0 && attachments.length === 0) {
    throw new ServiceError(
      appError("validation", "A comment needs a message or an attachment", { isRetryable: false }),
    );
  }

  // A comment body is prose, not an identifier: the name-based failure marker
  // would make any sentence containing "failing" unpostable.
  if (shouldFailWrite()) {
    throw new ServiceError(appError("unknown", "Your comment could not be posted"));
  }

  const targetKey = refKey(target);
  const comments = bucket(targetKey);
  const now = nowIso();

  const comment: Comment = {
    id: nextId("cmt"),
    targetKey,
    target,
    // A reply to a reply belongs to the same root — the thread stays two deep.
    parentId: rootIdFor(comments, parentId),
    author: currentAuthor(),
    body: trimmed,
    mentionedUserIds: extractMentionIds(trimmed),
    attachments,
    createdAt: now,
    updatedAt: now,
    isEdited: false,
  };

  catalog().set(targetKey, [...upsertComment(comments, comment)]);

  watchService.autoWatch(target, comment.author.id);
  fanOut(comment, target);
  boardService.noteActivity(target, `commented on ${target.label}`, "commented");

  realtime.emit({ type: "comment.created", targetKey, comment });
  return comment;
}

/** Resolve the root a reply belongs to; null when it is a root itself. */
function rootIdFor(comments: readonly Comment[], parentId: string | null): string | null {
  if (parentId === null) return null;

  const parent = comments.find((comment) => comment.id === parentId);
  if (!parent) throw notFound("That comment");

  return parent.parentId ?? parent.id;
}

/** Only the author may edit, and editing always stamps the "edited" label. */
async function edit(
  targetKey: string,
  commentId: string,
  body: string,
  signal?: AbortSignal,
): Promise<Comment> {
  await writeDelay(signal);

  const comments = bucket(targetKey);
  const current = comments.find((comment) => comment.id === commentId);
  if (!current) throw notFound("That comment");

  if (current.author.id !== CURRENT_USER.id) {
    throw permissionDenied(
      "You can only edit your own comments",
      "Reply instead to add to the thread.",
    );
  }

  const trimmed = body.trim();
  if (trimmed.length === 0 && current.attachments.length === 0) {
    throw new ServiceError(
      appError("validation", "A comment cannot be emptied", { isRetryable: false }),
    );
  }

  if (shouldFailWrite()) {
    throw new ServiceError(appError("unknown", "Your edit could not be saved"));
  }

  const updated: Comment = {
    ...current,
    body: trimmed,
    mentionedUserIds: extractMentionIds(trimmed),
    updatedAt: nowIso(),
    isEdited: true,
  };

  catalog().set(targetKey, [...upsertComment(comments, updated)]);
  realtime.emit({ type: "comment.updated", targetKey, comment: updated });

  return updated;
}

/**
 * Attach a file to a comment.
 *
 * The bytes stay in the browser as an object URL, matching how board
 * attachments work today; a real deployment swaps this for the upload service.
 */
async function attach(file: File, signal?: AbortSignal): Promise<CommentAttachment> {
  await writeDelay(signal);

  return {
    id: nextId("catt"),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null,
  };
}

/* ----------------------------------------------------------------- fan-out */

function fanOut(comment: Comment, target: EntityRef): void {
  const mentioned = new Set(comment.mentionedUserIds.filter((id) => id !== comment.author.id));

  for (const recipientId of mentioned) {
    notificationService.emit({
      reason: "mention",
      recipientId,
      actor: comment.author,
      title: `${comment.author.name} mentioned you`,
      body: preview(comment.body),
      target,
    });
  }

  // Watchers who were not mentioned hear about it once, as a comment.
  for (const recipientId of watchService.watchersOf(comment.targetKey, comment.author.id)) {
    if (mentioned.has(recipientId)) continue;

    notificationService.emit({
      reason: "comment",
      recipientId,
      actor: comment.author,
      title: `${comment.author.name} commented on ${target.label}`,
      body: preview(comment.body),
      target,
    });
  }
}

/** Test seam. */
function reset(): void {
  store = null;
}

export const commentService = {
  list,
  countFor,
  listMentioning,
  scan,
  add,
  edit,
  attach,
  reset,
};
