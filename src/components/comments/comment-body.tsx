"use client";

import { useMemo } from "react";
import { parseBody } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/mock/users";

/**
 * A comment body, rendered from parsed segments.
 *
 * Mentions and record references become tokens; a mention of the signed-in
 * user is emphasised, which is what makes "somebody is talking to me" readable
 * without opening the notification.
 */
export function CommentBody({ body, className }: { body: string; className?: string }) {
  const segments = useMemo(() => parseBody(body), [body]);

  return (
    <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground", className)}>
      {segments.map((segment, index) => {
        if (segment.kind === "text") return <span key={index}>{segment.text}</span>;

        if (segment.kind === "record") {
          return (
            <span
              key={index}
              className="metric rounded bg-hover px-1 text-[12px] text-foreground"
            >
              {segment.displayId}
            </span>
          );
        }

        const isMe = segment.userId === CURRENT_USER.id;
        return (
          <span
            key={index}
            className={cn(
              "rounded px-1 text-[12px] font-medium",
              isMe ? "bg-accent text-accent-foreground" : "bg-accent-soft text-accent",
            )}
          >
            @{segment.label}
          </span>
        );
      })}
    </p>
  );
}
