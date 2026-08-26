"use client";

import { Eye, GitCompare, LoaderCircle, RotateCcw } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VersionEntry } from "@/types";

interface VersionListProps {
  readonly entries: readonly VersionEntry[];
  readonly currentVersion: number;
  readonly selectedId: string | null;
  readonly canRestore: boolean;
  readonly restoringId: string | null;
  readonly onView: (entry: VersionEntry) => void;
  readonly onCompare: (entry: VersionEntry) => void;
  readonly onRestore: (entry: VersionEntry) => void;
}

/**
 * The history itself: when, by whom, and what it did. Entries with no snapshot
 * — a rotated secret — offer neither compare nor restore, because the client
 * has no plaintext to compare or restore *from*.
 */
export function VersionList({
  entries,
  currentVersion,
  selectedId,
  canRestore,
  restoringId,
  onView,
  onCompare,
  onRestore,
}: VersionListProps) {
  if (entries.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[12px] text-faint-foreground">
        No versions recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-1 p-2">
      {entries.map((entry) => {
        const isCurrent = entry.version === currentVersion;
        const isSelected = entry.id === selectedId;

        return (
          <li
            key={entry.id}
            className={cn(
              "rounded-lg border p-2.5 transition-colors",
              isSelected
                ? "border-accent bg-accent-soft"
                : isCurrent
                  ? "border-border bg-surface"
                  : "border-transparent hover:border-border",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="metric text-[11px] font-medium text-foreground">
                v{entry.version}
              </span>
              {isCurrent && (
                <span className="text-[10px] uppercase tracking-wide text-accent">current</span>
              )}
              <span className="metric ml-auto text-[10px] text-faint-foreground">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <UserAvatar user={entry.author} className="size-5" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {entry.author.name}
              </span>
              <span className="metric shrink-0 text-[10px] text-faint-foreground">
                {entry.summary}
              </span>
            </div>

            {entry.hasSnapshot && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1.5 px-1.5 text-[11px]"
                  onClick={() => onView(entry)}
                >
                  <Eye />
                  View
                </Button>

                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1.5 px-1.5 text-[11px]"
                    onClick={() => onCompare(entry)}
                  >
                    <GitCompare />
                    Compare
                  </Button>
                )}

                {!isCurrent && canRestore && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1.5 px-1.5 text-[11px]"
                    disabled={restoringId !== null}
                    onClick={() => onRestore(entry)}
                  >
                    {restoringId === entry.id ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <RotateCcw />
                    )}
                    Restore
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
