"use client";

import { ExternalLink, Link2, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkService } from "@/services/link-service";
import { toAppError } from "@/services/errors";
import { cn } from "@/lib/utils";
import type { AppError, LinkBlock as LinkBlockModel } from "@/types";

interface LinkBlockProps {
  readonly block: LinkBlockModel;
  readonly onChange: (block: LinkBlockModel) => void;
  readonly isEditable: boolean;
}

/** Bookmark card. Metadata comes from the link service, never from the UI. */
export function LinkBlock({ block, onChange, isEditable }: LinkBlockProps) {
  const [draftUrl, setDraftUrl] = useState(block.url);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function resolve(url: string) {
    if (!isEditable) return;

    setIsResolving(true);
    setError(null);

    try {
      const metadata = await linkService.resolve(url);
      onChange({
        ...block,
        url: metadata.url,
        title: metadata.title,
        description: metadata.description,
        siteName: metadata.siteName,
      });
    } catch (caught) {
      setError(toAppError(caught));
    } finally {
      setIsResolving(false);
    }
  }

  if (!block.url || !block.title) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-border bg-surface/60 p-3">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-faint-foreground" />
          <Input
            value={draftUrl}
            readOnly={!isEditable}
            placeholder="https://example.com/page"
            aria-label="Link URL"
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void resolve(draftUrl);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!isEditable || isResolving || draftUrl.trim().length === 0}
            onClick={() => void resolve(draftUrl)}
            className="gap-1.5"
          >
            {isResolving && <LoaderCircle className="animate-spin" />}
            {isResolving ? "Fetching…" : "Add link"}
          </Button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-[12px] text-danger">
            <TriangleAlert className="size-3.5 shrink-0" />
            {error.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <a
      href={block.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group/link flex items-start gap-3 rounded-lg border border-border bg-surface p-3 transition-colors",
        "hover:border-border-strong hover:bg-hover",
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-kind-board/12">
        <Link2 className="size-4 text-kind-board" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
            {block.title}
          </span>
          <ExternalLink className="size-3 shrink-0 text-faint-foreground opacity-0 transition-opacity group-hover/link:opacity-100" />
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[12px] text-muted-foreground">
          {block.description}
        </span>
        <span className="metric mt-1 block truncate text-[10px] text-faint-foreground">
          {block.siteName}
        </span>
      </span>

      {isEditable && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Replace link"
          onClick={(event) => {
            event.preventDefault();
            onChange({ ...block, title: "", description: "", siteName: "" });
          }}
        >
          <RotateCcw />
        </Button>
      )}
    </a>
  );
}
