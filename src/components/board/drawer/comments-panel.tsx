"use client";

import { MessageSquare, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useCommentDraft } from "@/hooks/use-comment-draft";
import { formatRelativeTime } from "@/lib/format";
import { extractRowReferences } from "@/lib/row-id";
import { boardService } from "@/services/board-service";
import type { BoardComment } from "@/types";

interface CommentsPanelProps {
  readonly boardId: string;
  readonly rowId: string;
}

/**
 * Comment thread. The composer is the part FUNC 11 pins down: an unsent draft
 * is written to local storage per row, so closing the drawer never loses it.
 * Mentions of `QA-128` are highlighted, ready for the linking module.
 */
export function CommentsPanel({ boardId, rowId }: CommentsPanelProps) {
  const { draft, setDraft, clearDraft } = useCommentDraft(rowId);
  const [isSending, setIsSending] = useState(false);

  const loader = useCallback(
    (signal: AbortSignal) => boardService.listComments(boardId, rowId, signal),
    [boardId, rowId],
  );

  const { state, setData } = useAsyncResource<readonly BoardComment[]>(loader);
  const comments = state.status === "success" ? state.data : [];

  async function send() {
    const body = draft.trim();
    if (body.length === 0) return;

    setIsSending(true);
    try {
      const comment = await boardService.addComment(boardId, rowId, body);
      setData([...comments, comment]);
      clearDraft();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
        <MessageSquare className="size-3.5" />
        Comments
        {comments.length > 0 && <span className="metric normal-case">· {comments.length}</span>}
      </h3>

      <ul className="space-y-2">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-2">
            <UserAvatar user={comment.author} className="size-6 shrink-0" />
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-2">
              <p className="flex items-baseline gap-2">
                <span className="text-[12px] font-medium text-foreground">
                  {comment.author.name}
                </span>
                <span className="metric text-[10px] text-faint-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-muted-foreground">
                {highlightReferences(comment.body)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-border bg-surface p-2">
        <textarea
          value={draft}
          rows={2}
          placeholder="Leave a comment… reference records like QA-128"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="New comment"
          className="w-full resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint-foreground"
        />
        <div className="flex items-center gap-2">
          <span className="metric text-[10px] text-faint-foreground">
            {draft.trim().length > 0 ? "Draft saved locally" : "Drafts are kept per record"}
          </span>
          <Button
            size="sm"
            variant="default"
            className="ml-auto h-6 gap-1.5 px-2 text-[11px]"
            disabled={draft.trim().length === 0 || isSending}
            onClick={() => void send()}
          >
            <Send className="size-3" />
            {isSending ? "Sending…" : "Comment"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Row references become visible tokens — the link target lands with FUNC 20. */
function highlightReferences(body: string): React.ReactNode {
  const references = extractRowReferences(body);
  if (references.length === 0) return body;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const [index, reference] of references.entries()) {
    const at = body.indexOf(reference.raw, cursor);
    if (at < 0) continue;

    if (at > cursor) parts.push(body.slice(cursor, at));
    parts.push(
      <span
        key={`${reference.raw}-${index}`}
        className="metric rounded bg-accent-soft px-1 text-[12px] text-accent"
      >
        {reference.raw}
      </span>,
    );
    cursor = at + reference.raw.length;
  }

  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}
