import type { Comment, CommentThread } from "@/types";

/**
 * Pure operations over a comment list.
 *
 * Every writer — the optimistic composer, the service reply and the realtime
 * event — goes through `upsertComment`, so applying the same comment twice is
 * a no-op instead of a duplicate.
 */

function byCreatedAt(a: Comment, b: Comment): number {
  const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/**
 * Insert or replace by id, keeping the list sorted oldest-first.
 *
 * This is the idempotency guarantee the realtime layer relies on: a frame that
 * arrives after the optimistic insert replaces it rather than appending a
 * second copy.
 */
export function upsertComment(
  comments: readonly Comment[],
  incoming: Comment,
): readonly Comment[] {
  const index = comments.findIndex((comment) => comment.id === incoming.id);

  if (index >= 0) {
    const current = comments[index];
    if (current === incoming) return comments;

    const next = [...comments];
    next[index] = incoming;
    return next;
  }

  return [...comments, incoming].sort(byCreatedAt);
}

/**
 * Swap an optimistic comment for the server's answer.
 *
 * Written as remove-then-upsert rather than an in-place swap because the
 * realtime frame for the same write may already have inserted the saved
 * comment — this way both orders converge on exactly one copy.
 */
export function replaceComment(
  comments: readonly Comment[],
  temporaryId: string,
  saved: Comment,
): readonly Comment[] {
  return upsertComment(removeComment(comments, temporaryId), saved);
}

export function removeComment(comments: readonly Comment[], id: string): readonly Comment[] {
  const next = comments.filter((comment) => comment.id !== id);
  return next.length === comments.length ? comments : next;
}

/**
 * Roots with their replies, oldest first.
 *
 * A reply whose root is gone is promoted to a root rather than dropped — an
 * orphan is still somebody's comment.
 */
export function buildThreads(comments: readonly Comment[]): readonly CommentThread[] {
  const ordered = [...comments].sort(byCreatedAt);
  const roots = ordered.filter((comment) => comment.parentId === null);
  const rootIds = new Set(roots.map((comment) => comment.id));

  const orphans = ordered.filter(
    (comment) => comment.parentId !== null && !rootIds.has(comment.parentId),
  );

  const repliesByRoot = new Map<string, Comment[]>();
  for (const comment of ordered) {
    if (comment.parentId === null || !rootIds.has(comment.parentId)) continue;
    const bucket = repliesByRoot.get(comment.parentId);
    if (bucket) bucket.push(comment);
    else repliesByRoot.set(comment.parentId, [comment]);
  }

  return [...roots, ...orphans]
    .sort(byCreatedAt)
    .map((root) => ({ root, replies: repliesByRoot.get(root.id) ?? [] }));
}
