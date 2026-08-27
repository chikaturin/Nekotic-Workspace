"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveLabelFor } from "@/lib/archive";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode } from "@/types";

interface ArchivedBannerProps {
  /** The archived node — the subject itself, or an ancestor freezing it. */
  readonly source: DriveNode | null;
  readonly subject: DriveNode;
  readonly canRestore: boolean;
}

/**
 * Read-only notice for archived content (SY-ARC-37).
 *
 * Archiving is inherited, so the banner names the node that actually holds the
 * freeze: restoring a page that sits inside an archived project would not
 * unfreeze it, and saying "Restore this page" there would be a lie.
 */
export function ArchivedBanner({ source, subject, canRestore }: ArchivedBannerProps) {
  const setNodeArchived = useWorkspaceStore((state) => state.setNodeArchived);
  if (!source) return null;

  const isInherited = source.id !== subject.id;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2"
    >
      <Archive className="size-3.5 shrink-0 text-muted-foreground" />

      <p className="min-w-0 flex-1 text-ui text-foreground">
        {isInherited ? (
          <>
            Inside the archived {archiveLabelFor(source)}{" "}
            <span className="font-medium">“{source.name}”</span> — this{" "}
            {archiveLabelFor(subject)} is read-only until that {archiveLabelFor(source)} is
            restored.
          </>
        ) : (
          <>
            This {archiveLabelFor(subject)} is archived — it can be read and searched, but not
            edited.
          </>
        )}
      </p>

      {canRestore && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setNodeArchived(source.id, false)}
        >
          <ArchiveRestore />
          Restore {isInherited ? `“${source.name}”` : ""}
        </Button>
      )}
    </div>
  );
}
