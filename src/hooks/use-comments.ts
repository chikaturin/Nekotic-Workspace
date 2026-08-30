"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useDirectory } from "@/hooks/use-directory";
import { buildThreads, removeComment, replaceComment, upsertComment } from "@/lib/comments";
import { refKey } from "@/lib/entity-ref";
import { extractMentionIds, resolveMentions } from "@/lib/mentions";
import { realtime } from "@/lib/realtime/client";
import { commentService } from "@/services/comment-service";
import { toAppError } from "@/services/errors";
import { currentUser, currentUserId } from "@/store/session-store";
import { useWatchStore } from "@/store/watch-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  AsyncState,
  Comment,
  CommentAttachment,
  CommentThread,
  DirectoryUser,
  EntityRef,
} from "@/types";
import { useUploadStore } from "@/store/upload-store";

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

export function useComments(target: EntityRef): CommentsController {
  const targetKey = refKey(target);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const directory = useDirectory();
  const [isBusy, setIsBusy] = useState(false);

  const loader = useCallback(
    (signal: AbortSignal) => commentService.list(target, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `targetKey` là dạng chuỗi của `target`.
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
      // Ô soạn thảo giữ `@Tên` cho dễ đọc; dạng lưu trữ mang id, vì tên người
      // ta có thể đổi còn id thì không.
      const trimmed = resolveMentions(body.trim(), directory);
      if (trimmed.length === 0 && attachments.length === 0) return false;

      const temporaryId = `tmp_cmt_${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const optimistic: Comment = {
        id: temporaryId,
        targetKey,
        target,
        parentId,
        author: { ...currentUser(), isActive: true },
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
        announceMentions(saved.mentionedUserIds, directory, pushFeedback);

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
    [target, targetKey, directory, patchData, pushFeedback],
  );

  const edit = useCallback(
    async (commentId: string, body: string) => {
      setIsBusy(true);

      try {
        const updated = await commentService.edit(
          commentId,
          resolveMentions(body, directory),
        );
        patchData((current) => upsertComment(current, updated));
        return true;
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [patchData, pushFeedback, directory],
  );

  const attach = useCallback(
    async (file: File) => {
      try {
        // Tệp của bình luận. Không khai chỗ ở thì nó rơi thẳng vào gốc Drive
        // của workspace — đúng thứ người dùng không hề yêu cầu.
        const asset = await useUploadStore
          .getState()
          .uploadOne(file, null, { kind: "comment" });

        if (asset === null) return null;

        return {
          id: asset.id,
          name: asset.name,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          url: asset.thumbnailUrl ?? null,
        };
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
        return null;
      }
    },
    [pushFeedback],
  );

  return { state, threads, count: comments.length, isBusy, reload, post, edit, attach };
}

function announceMentions(
  mentionedUserIds: readonly string[],
  directory: readonly DirectoryUser[],
  pushFeedback: (message: string, tone?: "info" | "success" | "error") => void,
): void {
  const names = mentionedUserIds
    .filter((id) => id !== currentUserId())
    .map((id) => directory.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return;

  pushFeedback(
    names.length === 1 ? `Notified ${names[0]}` : `Notified ${names.length} people`,
    "success",
  );
}
