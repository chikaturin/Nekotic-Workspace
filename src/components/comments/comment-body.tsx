"use client";

import { useMemo } from "react";
import { parseBody } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/store/session-store";

export function CommentBody({ body, className }: { body: string; className?: string }) {
  const meId = useCurrentUserId();

  const segments = useMemo(() => parseBody(body), [body]);

  return (
    <p className={cn("whitespace-pre-wrap text-lead leading-relaxed text-muted-foreground", className)}>
      {segments.map((segment, index) => {
        if (segment.kind === "text") return <span key={index}>{segment.text}</span>;

        if (segment.kind === "record") {
          return (
            <span
              key={index}
              className="metric rounded bg-hover px-1 text-ui text-foreground"
            >
              {segment.displayId}
            </span>
          );
        }

        const isMe = segment.userId === meId;
        return (
          <span
            key={index}
            className={cn(
              "rounded px-1 text-ui font-medium",
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
