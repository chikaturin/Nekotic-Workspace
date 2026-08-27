"use client";

import { Paperclip, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { CommentAttachment } from "@/types";

interface CommentAttachmentsProps {
  readonly attachments: readonly CommentAttachment[];
  /** Present only in the composer, where an attachment can still be removed. */
  readonly onRemove?: (id: string) => void;
}

const isImage = (file: CommentAttachment) => file.mimeType.startsWith("image/");

/** Files on a comment: image thumbnails inline, everything else as a chip. */
export function CommentAttachments({ attachments, onRemove }: CommentAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {attachments.map((file) => (
        <li key={file.id} className="group relative">
          {isImage(file) && file.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- session object URL
            <img
              src={file.url}
              alt={file.name}
              className="size-16 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1">
              <Paperclip className="size-3 shrink-0 text-faint-foreground" />
              <span className="max-w-40 truncate text-body text-foreground">{file.name}</span>
              <span className="metric text-micro text-faint-foreground">
                {formatBytes(file.sizeBytes)}
              </span>
            </span>
          )}

          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemove(file.id)}
              className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground hover:text-foreground group-hover:flex"
            >
              <X className="size-2.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
