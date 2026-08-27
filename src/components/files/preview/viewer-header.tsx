"use client";

import { Download, Info, PanelRightClose, Pencil, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { FavoriteButton } from "@/components/shared/favorite-star";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDate } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { FileNode } from "@/types";

interface ViewerHeaderProps {
  readonly node: FileNode;
  readonly canEdit: boolean;
  readonly canDownload: boolean;
  readonly isDetailsOpen: boolean;
  readonly onToggleDetails: () => void;
  readonly onDownload: () => void;
  readonly onClose: () => void;
}

/** Identity, rename and the viewer-wide actions. */
export function ViewerHeader({
  node,
  canEdit,
  canDownload,
  isDetailsOpen,
  onToggleDetails,
  onDownload,
  onClose,
}: ViewerHeaderProps) {
  const renameNode = useWorkspaceStore((store) => store.renameNode);
  const [draftName, setDraftName] = useState<string | null>(null);
  /** Escape must win over the blur that follows it. */
  const isCancellingRef = useRef(false);
  const visual = nodeVisual(node);

  function commitRename() {
    if (isCancellingRef.current) {
      isCancellingRef.current = false;
    } else if (draftName !== null && draftName.trim().length > 0) {
      renameNode(node.id, draftName);
    }
    setDraftName(null);
  }

  function handleRenameKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
      return;
    }
    if (event.key === "Escape") {
      // Stop the key from also closing the whole viewer.
      event.preventDefault();
      event.stopPropagation();
      isCancellingRef.current = true;
      setDraftName(null);
    }
  }

  const isRenaming = draftName !== null;

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", visual.tintClass)}>
        <visual.Icon className={cn("size-5", visual.colorClass)} strokeWidth={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <DialogTitle
          className={cn(
            "truncate text-title font-semibold tracking-tight text-foreground",
            isRenaming && "sr-only",
          )}
        >
          {node.name}
        </DialogTitle>

        <DialogDescription
          className={cn(
            "metric truncate text-body text-faint-foreground",
            isRenaming && "sr-only",
          )}
        >
          {visual.label} · {formatBytes(node.sizeBytes)} · {formatDate(node.createdAt)}
        </DialogDescription>

        {isRenaming && (
          <Input
            value={draftName}
            autoFocus
            aria-label="File name"
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={handleRenameKey}
            onBlur={commitRename}
            className="h-7 max-w-md text-lead font-medium"
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canEdit && !isRenaming && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDraftName(node.name)}
            className="gap-1.5"
          >
            <Pencil />
            <span className="hidden sm:inline">Rename</span>
          </Button>
        )}

        <FavoriteButton node={node} />

        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Download"
          disabled={!canDownload}
          onClick={onDownload}
        >
          <Download />
        </Button>

        <Button
          size="icon-sm"
          variant={isDetailsOpen ? "subtle" : "ghost"}
          aria-label="Toggle file details"
          aria-pressed={isDetailsOpen}
          onClick={onToggleDetails}
        >
          {isDetailsOpen ? <PanelRightClose /> : <Info />}
        </Button>

        <Button size="icon-sm" variant="ghost" aria-label="Close viewer" onClick={onClose}>
          <X />
        </Button>
      </div>
    </header>
  );
}
