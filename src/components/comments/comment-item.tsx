"use client";

import { Pencil, Reply } from "lucide-react";
import { useState } from "react";
import { CommentAttachments } from "@/components/comments/comment-attachments";
import { CommentBody } from "@/components/comments/comment-body";
import { plainBody } from "@/lib/mentions";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/store/session-store";
import type { Comment, DirectoryUser } from "@/types";

interface CommentItemProps {
  readonly comment: Comment;
  readonly people: readonly DirectoryUser[];
  readonly isBusy: boolean;
  readonly onEdit: (body: string) => Promise<boolean>;
  readonly onReply?: () => void;
  readonly isReply?: boolean;
}

export function CommentItem({
  comment,
  people,
  isBusy,
  onEdit,
  onReply,
  isReply = false,
}: CommentItemProps) {
  const [editValue, setEditValue] = useState<string | null>(null);
  const isMine = comment.author.id === useCurrentUserId();
  const isEditing = editValue !== null;

  async function save() {
    if (editValue === null) return;
    if (await onEdit(editValue)) setEditValue(null);
  }

  return (
    <article className={cn("flex gap-2", isReply && "pl-6")}>
      <UserAvatar user={comment.author} className={isReply ? "size-5 shrink-0" : "size-6 shrink-0"} />

      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-2",
          comment.isPending && "is-pending",
        )}
      >
        <header className="flex items-baseline gap-2">
          <span className="truncate text-ui font-medium text-foreground">
            {comment.author.name}
          </span>
          {!comment.author.isActive && (
            <span className="metric text-micro text-faint-foreground">former member</span>
          )}
          <span className="metric text-micro text-faint-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span
              className="metric text-micro text-faint-foreground"
              title={`Edited ${formatRelativeTime(comment.updatedAt)}`}
            >
              · edited
            </span>
          )}
          {comment.isPending && (
            <span className="metric text-micro text-faint-foreground">· sending…</span>
          )}
        </header>

        {isEditing ? (
          <div className="mt-1">
            <MentionTextarea
              value={editValue}
              onChange={setEditValue}
              people={people}
              placeholder="Edit your comment…"
              ariaLabel="Edit comment"
              autoFocus
              onSubmit={() => void save()}
              onEscape={() => setEditValue(null)}
            />
            <div className="mt-1 flex items-center gap-1.5">
              <Button
                size="sm"
                variant="default"
                className="h-6 px-2 text-body"
                disabled={isBusy || editValue.trim().length === 0}
                onClick={() => void save()}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-body"
                onClick={() => setEditValue(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <CommentBody body={comment.body} className="mt-0.5" />
            <CommentAttachments attachments={comment.attachments} />

            {(onReply || isMine) && !comment.isPending && (
              <div className="mt-1 flex items-center gap-0.5">
                {onReply && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 gap-1 px-1.5 text-micro"
                    onClick={onReply}
                  >
                    <Reply />
                    Reply
                  </Button>
                )}
                {isMine && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 gap-1 px-1.5 text-micro"
                    // Mở ra để sửa thì hiện `@Tên`, không phải dạng lưu trữ.
                    onClick={() => setEditValue(plainBody(comment.body))}
                  >
                    <Pencil />
                    Edit
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
