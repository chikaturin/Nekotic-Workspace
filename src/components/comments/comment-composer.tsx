"use client";

import { Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { CommentAttachments } from "@/components/comments/comment-attachments";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { Button } from "@/components/ui/button";
import { peekCommentDraft, useCommentDraft } from "@/hooks/use-comment-draft";
import type { CommentAttachment, DirectoryUser } from "@/types";

interface CommentComposerProps {
  readonly draftKey: string;
  readonly people: readonly DirectoryUser[];
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly isBusy: boolean;
  readonly autoFocus?: boolean;
  readonly onSubmit: (
    body: string,
    attachments: readonly CommentAttachment[],
  ) => Promise<boolean>;
  readonly onAttach: (file: File) => Promise<CommentAttachment | null>;
  readonly onCancel?: () => void;
}

export function CommentComposer({
  draftKey,
  people,
  placeholder,
  submitLabel,
  isBusy,
  autoFocus = false,
  onSubmit,
  onAttach,
  onCancel,
}: CommentComposerProps) {
  const { draft, setDraft } = useCommentDraft(draftKey);
  const [attachments, setAttachments] = useState<readonly CommentAttachment[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !isBusy;

  async function send() {
    if (!canSend) return;

    const submitted = draft;
    const sent = attachments;

    const posted = await onSubmit(submitted, sent);
    if (!posted) return;

    const current = peekCommentDraft(draftKey);
    setDraft(current.startsWith(submitted) ? current.slice(submitted.length) : current);
    setAttachments((all) => all.filter((file) => !sent.includes(file)));
  }

  async function addFiles(files: readonly File[]) {
    if (files.length === 0) return;
    setIsAttaching(true);

    try {
      const added = await Promise.all(files.map((file) => onAttach(file)));
      const kept = added.filter((file): file is CommentAttachment => file !== null);
      if (kept.length > 0) setAttachments((current) => [...current, ...kept]);
    } finally {
      setIsAttaching(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-2 focus-within:border-border-strong">
      <MentionTextarea
        value={draft}
        onChange={setDraft}
        people={people}
        placeholder={placeholder}
        ariaLabel={submitLabel}
        autoFocus={autoFocus}
        onSubmit={() => void send()}
        {...(onCancel ? { onEscape: onCancel } : {})}
      />

      <CommentAttachments
        attachments={attachments}
        onRemove={(id) =>
          setAttachments((current) => current.filter((file) => file.id !== id))
        }
      />

      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Attach a file"
          disabled={isAttaching}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip />
        </Button>

        <span className="metric truncate text-micro text-faint-foreground">
          {isAttaching
            ? "Attaching…"
            : draft.trim().length > 0
              ? "Draft saved · @ to mention · ↵ to send · ⇧↵ for a new line"
              : "@ to mention a teammate"}
        </span>

        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 gap-1 px-2 text-body"
            onClick={onCancel}
          >
            <X />
            Cancel
          </Button>
        )}

        <Button
          size="sm"
          variant="default"
          className={onCancel ? "h-6 gap-1.5 px-2 text-body" : "ml-auto h-6 gap-1.5 px-2 text-body"}
          disabled={!canSend}
          onClick={() => void send()}
        >
          <Send />
          {isBusy ? "Sending…" : submitLabel}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = "";
          void addFiles(picked);
        }}
      />
    </div>
  );
}
