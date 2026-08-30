"use client";

import { Archive, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceDocument } from "@/types";

interface LockedBannerProps {
  readonly document: WorkspaceDocument;
  readonly canToggleLock: boolean;
  readonly onUnlock: () => void;
  readonly onRestore: () => void;
}

export function LockedBanner({
  document,
  canToggleLock,
  onUnlock,
  onRestore,
}: LockedBannerProps) {
  if (!document.isLocked && !document.isArchived) return null;

  const isLocked = document.isLocked;
  const Icon = isLocked ? Lock : Archive;

  return (
    <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />

      <p className="min-w-0 flex-1 text-lead text-muted-foreground">
        {isLocked ? (
          <>
            This page is locked
            {document.lockedBy ? ` by ${document.lockedBy.name}` : ""}. Editing is disabled until it
            is unlocked.
          </>
        ) : (
          "This page is archived. Restore it to continue editing."
        )}
      </p>

      {isLocked ? (
        <Button
          size="sm"
          variant="outline"
          disabled={!canToggleLock}
          onClick={onUnlock}
          className="gap-1.5"
        >
          <LockOpen />
          Unlock
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onRestore}>
          Restore
        </Button>
      )}
    </div>
  );
}
