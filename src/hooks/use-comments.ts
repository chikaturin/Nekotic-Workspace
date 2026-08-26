"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { buildThreads, removeComment, replaceComment, upsertComment } from "@/lib/comments";
import { refKey } from "@/lib/entity-ref";
import { extractMentionIds } from "@/lib/mentions";
import { realtime } from "@/lib/realtime/client";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import { commentService } from "@/services/comment-service";
import { toAppError } from "@/services/errors";
import { useWatchStore } from "@/store/watch-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, Comment, CommentAttachment, CommentThread, EntityRef } from "@/types";

/** Stable empty list, so an unloaded thread does not re-memoise every render. */
const NO_COMMENTS: readonly Comment[] = [];

export interface PostCommentInput {
  readonly body: string;
  readonly parentId?: string | null;
  readonly attachments?: readonly CommentAttachment[];
}

export interface CommentsController {
  readonly state: AsyncState<readonly Comment[]>;
  readonly threads: readonly CommentThread[];
  readonly count: number;
  readonly isBusy: boolean;
  readonly reload: () => void;
  post: (input: PostCommentInput) => Promise<boolean>;
  edit: (commentId: string, body: string) => Promise<boolean>;
  attach: (file: File) => Promise<CommentAttachment | null>;
}

/**
 * One comment thread, wherever it hangs.
 *
 * Writes are optimistic and the realtime frame for the same write lands on the
 * same list; both go through `upsertComment`, so whichever arrives second is a
 * replacement rather than a duplicate.
 */
export function useComments(target: EntityRef): CommentsController {
  const targetKey = refKey(target);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const [isBusy, setIsBusy] = useState(false);

  const loader = useCallback(
    (signal: AbortSignal) => commentService.list(targetKey, signal),
    [targetKey],
  );

  const { state, patchData, reload } = useAsyncResource<readonly Comment[]>(loader);

  useEffect(
    () =>
      realtime.subscribe((event) => {
        const { payload } = event;
        if (payload.type !== "comment.created" && payload.type !== "comment.updated") return;
        if (payload.targetKey !== targetKey) return;

        patchData((current) => upsertComment(current, payload.comment));
      }),
    [targetKey, patchData],
  );

  const comments = useMemo(
    () => (state.status === "success" ? state.data : NO_COMMENTS),
    [state],
  );
  const threads = useMemo(() => buildThreads(comments), [comments]);

  const post = useCallback(
    async ({ body, parentId = null, attachments = [] }: PostCommentInput) => {
      const trimmed = body.trim();
      if (trimmed.length === 0 && attachments.length === 0) return false;

      const temporaryId = `tmp_cmt_${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const optimistic: Comment = {
        id: temporaryId,
        targetKey,
        target,
        parentId,
        author: DIRECTORY.find((person) => person.id === CURRENT_USER.id) ?? DIRECTORY[0]!,
        body: trimmed,
        mentionedUserIds: extractMentionIds(trimmed),
        attachments,
        createdAt: now,
        updatedAt: now,
        isEdited: false,
        isPending: true,
      };

      patchData((current) => upsertComment(current, optimistic));
      setIsBusy(true);

      try {
        const saved = await commentService.add({ target, body: trimmed, parentId, attachments });
        patchData((current) => replaceComment(current, temporaryId, saved));
        announceMentions(saved.mentionedUserIds, pushFeedback);

        // Posting makes the author a watcher; the follow button has to hear
        // about it or its next click would be a no-op that toasts "Following".
        void useWatchStore.getState().refresh();
        return true;
      } catch (error) {
        patchData((current) => removeComment(current, temporaryId));
        pushFeedback(toAppError(error).message, "error");
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [target, targetKey, patchData, pushFeedback],
  );

  const edit = useCallback(
    async (commentId: string, body: string) => {
      setIsBusy(true);

      try {
        const updated = await commentService.edit(targetKey, commentId, body);
        patchData((current) => upsertComment(current, updated));
        return true;
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [targetKey, patchData, pushFeedback],
  );

  const attach = useCallback(
    async (file: File) => {
      try {
        return await commentService.attach(file);
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
        return null;
      }
    },
    [pushFeedback],
  );

  return { state, threads, count: comments.length, isBusy, reload, post, edit, attach };
}

/** Mentioning someone is invisible otherwise — say who was actually notified. */
function announceMentions(
  mentionedUserIds: readonly string[],
  pushFeedback: (message: string, tone?: "info" | "success" | "error") => void,
): void {
  const names = mentionedUserIds
    .filter((id) => id !== CURRENT_USER.id)
    .map((id) => DIRECTORY.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return;

  pushFeedback(
    names.length === 1 ? `Notified ${names[0]}` : `Notified ${names.length} people`,
    "success",
  );
}
