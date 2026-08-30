import { collabApi, type CreateCommentInput } from "@/services/api/collab.api";
import type { Comment, CommentAttachment, EntityRef } from "@/types";

export interface AddCommentInput {
  readonly target: EntityRef;
  readonly body: string;
  readonly parentId?: string | null;
  readonly attachments?: readonly CommentAttachment[];
}

export const commentService = {
  list: async (
    target: EntityRef,
    signal?: AbortSignal,
  ): Promise<readonly Comment[]> => (await collabApi.comments(target, signal)).items,

  replies: async (
    commentId: string,
    signal?: AbortSignal,
  ): Promise<readonly Comment[]> => (await collabApi.replies(commentId, signal)).items,

  add: (input: AddCommentInput): Promise<Comment> => {
    const payload: CreateCommentInput = {
      target: input.target,
      body: input.body,
      ...(input.parentId == null ? {} : { parentId: input.parentId }),
      ...(input.attachments === undefined
        ? {}
        : { attachmentIds: input.attachments.map((file) => file.id) }),
    };

    return collabApi.createComment(payload);
  },

  edit: (commentId: string, body: string) =>
    collabApi.editComment(commentId, body),

  remove: (commentId: string) => collabApi.deleteComment(commentId),

  resolve: (commentId: string, isResolved: boolean) =>
    collabApi.resolveComment(commentId, isResolved),
};
