"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentItem } from "@/components/comments/comment-item";
import { InlineSpinner } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import { useComments } from "@/hooks/use-comments";
import { refKey } from "@/lib/entity-ref";
import { cn } from "@/lib/utils";
import type { DirectoryUser, EntityRef } from "@/types";

interface CommentPanelProps {
  readonly target: EntityRef;
  readonly people: readonly DirectoryUser[];
  /** Read-only viewers still see the thread; they just cannot add to it. */
  readonly canComment: boolean;
  readonly className?: string;
}

/**
 * Comments on anything (CO-CMT-26).
 *
 * The same panel serves a record drawer and a page, because a thread only
 * needs its target — the drawer does not own the comment model, and neither
 * does the editor.
 */
export function CommentPanel({ target, people, canComment, className }: CommentPanelProps) {
  const controller = useComments(target);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const targetKey = refKey(target);
  const isLoading = controller.state.status === "loading" || controller.state.status === "idle";
  const failure = controller.state.status === "error" ? controller.state.error : null;

  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
        <MessageSquare className="size-3.5" />
        Comments
        {controller.count > 0 && (
          <span className="metric normal-case">· {controller.count}</span>
        )}
        {isLoading && <span className="ml-auto"><InlineSpinner label="Loading" /></span>}
      </h3>

      {failure && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-2">
          <span className="min-w-0 flex-1 text-[12px] text-foreground">{failure.message}</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={controller.reload}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !failure && controller.threads.length === 0 && (
        <p className="text-[12px] text-faint-foreground">
          No comments yet. Mention a teammate with @ to pull them in.
        </p>
      )}

      <ul className="space-y-3">
        {controller.threads.map((thread) => (
          <li key={thread.root.id} className="space-y-2">
            <CommentItem
              comment={thread.root}
              people={people}
              isBusy={controller.isBusy}
              onEdit={(body) => controller.edit(thread.root.id, body)}
              {...(canComment ? { onReply: () => setReplyToId(thread.root.id) } : {})}
            />

            {thread.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                people={people}
                isBusy={controller.isBusy}
                isReply
                onEdit={(body) => controller.edit(reply.id, body)}
              />
            ))}

            {canComment && replyToId === thread.root.id && (
              <div className="pl-6">
                <CommentComposer
                  key={`${targetKey}#${thread.root.id}`}
                  draftKey={`${targetKey}#${thread.root.id}`}
                  people={people}
                  placeholder={`Reply to ${thread.root.author.name}…`}
                  submitLabel="Reply"
                  isBusy={controller.isBusy}
                  autoFocus
                  onCancel={() => setReplyToId(null)}
                  onAttach={controller.attach}
                  onSubmit={async (body, attachments) => {
                    const posted = await controller.post({
                      body,
                      parentId: thread.root.id,
                      attachments,
                    });
                    if (posted) setReplyToId(null);
                    return posted;
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canComment ? (
        <CommentComposer
          // Attachments live in component state; a new target starts fresh.
          key={targetKey}
          draftKey={targetKey}
          people={people}
          placeholder="Leave a comment… @ to mention, or reference records like QA-128"
          submitLabel="Comment"
          isBusy={controller.isBusy}
          onAttach={controller.attach}
          onSubmit={(body, attachments) => controller.post({ body, attachments })}
        />
      ) : (
        <p className="metric text-[10px] text-faint-foreground">
          You have read-only access to this thread.
        </p>
      )}
    </section>
  );
}
