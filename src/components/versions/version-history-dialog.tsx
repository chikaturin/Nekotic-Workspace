"use client";

import { History, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { VersionDetail, type VersionMode } from "@/components/versions/version-detail";
import { VersionList } from "@/components/versions/version-list";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { VersionHistory } from "@/hooks/use-version-history";
import type { VersionEntry } from "@/types";

interface VersionHistoryDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly history: VersionHistory;
  readonly notice?: string;
  readonly onClose: () => void;
}

export function VersionHistoryDialog({
  isOpen,
  title,
  history,
  notice,
  onClose,
}: VersionHistoryDialogProps) {
  const [selected, setSelected] = useState<VersionEntry | null>(null);
  const [mode, setMode] = useState<VersionMode>("view");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        setSelected(null);
        onClose();
      }}
    >
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col p-0">
        <header className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lead font-semibold text-foreground">
            <History className="size-4 text-accent" />
            Version history · {title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-ui text-muted-foreground">
            {history.canRestore
              ? "Restoring writes a new version instead of rewinding, so the record of what happened stays complete."
              : "A read-only record of what changed, when, and who changed it."}
          </DialogDescription>
        </header>

        {notice && (
          <p className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-5 py-2 text-body text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-success" />
            {notice}
          </p>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 w-72 shrink-0 overflow-y-auto border-r border-border">
            <AsyncBoundary state={history.state} onRetry={history.reload} loading={<ListSkeleton />}>
              {(entries) => (
                <VersionList
                  entries={entries}
                  currentVersion={history.currentVersion}
                  selectedId={selected?.id ?? null}
                  canRestore={history.canRestore}
                  restoringId={history.restoringId}
                  onView={(entry) => {
                    setSelected(entry);
                    setMode("view");
                  }}
                  onCompare={(entry) => {
                    setSelected(entry);
                    setMode("compare");
                  }}
                  onRestore={(entry) => void history.restore(entry)}
                />
              )}
            </AsyncBoundary>
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            <VersionDetail entry={selected} mode={mode} currentLines={history.currentLines} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5 p-2" aria-busy="true">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}
