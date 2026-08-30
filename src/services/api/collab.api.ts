import { apiFetch, apiSend } from "@/services/http/client";
import type {
  AppNotification,
  Comment,
  EntityRef,
  WatchEntry,
} from "@/types";

export interface CommentPage {
  readonly items: readonly Comment[];
  readonly nextCursor: string | null;
  readonly replyCountByRootId: Readonly<Record<string, number>>;
}

export interface CreateCommentInput {
  readonly target: EntityRef;
  readonly body: string;
  readonly parentId?: string | null;
  readonly attachmentIds?: readonly string[];
}

export interface NotificationPage {
  readonly items: readonly AppNotification[];
  readonly nextCursor: string | null;
}

const refQuery = (ref: EntityRef): Readonly<Record<string, string | undefined>> => ({
  targetKind: ref.kind,
  targetNodeId: ref.nodeId,
  ...(ref.kind === "row"
    ? { targetBoardId: ref.boardId ?? ref.nodeId, targetRowId: ref.rowId }
    : {}),
});

export const collabApi = {
  comments: (ref: EntityRef, signal?: AbortSignal) =>
    apiFetch<CommentPage>("/comments", { query: refQuery(ref), signal }),

  replies: (commentId: string, signal?: AbortSignal) =>
    apiFetch<CommentPage>(`/comments/${commentId}/replies`, { signal }),

  createComment: (input: CreateCommentInput) =>
    apiFetch<Comment>("/comments", { method: "POST", body: input }),

  editComment: (commentId: string, body: string) =>
    apiFetch<Comment>(`/comments/${commentId}`, {
      method: "PATCH",
      body: { body },
    }),

  deleteComment: (commentId: string) =>
    apiSend(`/comments/${commentId}`, { method: "DELETE" }),

  resolveComment: (commentId: string, isResolved: boolean) =>
    apiFetch<Comment>(`/comments/${commentId}/resolve`, {
      method: isResolved ? "POST" : "DELETE",
    }),

  watches: (signal?: AbortSignal) =>
    apiFetch<readonly WatchEntry[]>("/me/watches", { signal }),

  setWatch: (ref: EntityRef, isWatching: boolean) =>
    apiFetch<readonly WatchEntry[]>("/me/watches", {
      method: isWatching ? "PUT" : "DELETE",
      body: { ref },
    }),

  notifications: (
    query: { readonly tab?: string; readonly cursor?: string } = {},
    signal?: AbortSignal,
  ) => apiFetch<NotificationPage>("/me/notifications", { query, signal }),

  unreadCount: (signal?: AbortSignal) =>
    apiFetch<{ readonly unreadCount: number }>(
      "/me/notifications/unread-count",
      { signal },
    ),

  markRead: (notificationIds: readonly string[]) =>
    apiSend("/me/notifications/read", {
      method: "POST",
      body: { notificationIds },
    }),

  markAllRead: () => apiSend("/me/notifications/read-all", { method: "POST" }),
};
