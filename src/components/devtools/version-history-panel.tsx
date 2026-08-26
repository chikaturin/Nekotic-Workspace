"use client";

import { History, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { formatRelativeTime } from "@/lib/format";
import { devtoolsService } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { ConfigDocument, ConfigVersion } from "@/types";

interface VersionHistoryPanelProps {
  readonly nodeId: string;
  readonly currentVersion: number;
  readonly canEdit: boolean;
  readonly onRestored: (document: ConfigDocument) => void;
}

/**
 * Version history for a config document. Restoring writes a *new* version
 * rather than rewinding, so the record of what happened stays complete.
 */
export function VersionHistoryPanel({
  nodeId,
  currentVersion,
  canEdit,
  onRestored,
}: VersionHistoryPanelProps) {
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) => devtoolsService.listConfigVersions(nodeId, signal),
    [nodeId],
  );

  const { state, reload } = useAsyncResource<readonly ConfigVersion[]>(loader, {
    keepPreviousData: true,
  });

  const versions = state.status === "success" ? state.data : [];

  async function restore(version: ConfigVersion) {
    setRestoringId(version.id);

    try {
      const next = await devtoolsService.restoreConfigVersion(nodeId, version.id);
      onRestored(next);
      reload();
      pushFeedback(`Restored version ${version.version}`, "success");
    } catch (error) {
      pushFeedback(toAppError(error).message, "error");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <aside
      aria-label="Version history"
      className="flex w-72 shrink-0 flex-col border-l border-border bg-background"
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b border-hairline px-3 py-2.5">
        <History className="size-3.5 text-faint-foreground" />
        <h2 className="text-[12px] font-medium text-foreground">Version history</h2>
        <span className="metric ml-auto text-[10px] text-faint-foreground">
          {versions.length}
        </span>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto p-2">
        {versions.map((version) => (
          <li
            key={version.id}
            className={cn(
              "rounded-lg border p-2.5",
              version.version === currentVersion
                ? "border-accent bg-accent-soft"
                : "border-transparent hover:border-border",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="metric text-[11px] font-medium text-foreground">
                v{version.version}
              </span>
              {version.version === currentVersion && (
                <span className="text-[10px] uppercase tracking-wide text-accent">current</span>
              )}
              <span className="metric ml-auto text-[10px] text-faint-foreground">
                {formatRelativeTime(version.createdAt)}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <UserAvatar user={version.author} className="size-5" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {version.author.name}
              </span>
              <span className="metric shrink-0 text-[10px] text-faint-foreground">
                {version.summary}
              </span>
            </div>

            {version.version !== currentVersion && canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-6 w-full justify-start gap-1.5 px-1 text-[11px]"
                disabled={restoringId === version.id}
                onClick={() => void restore(version)}
              >
                <RotateCcw className="size-3" />
                {restoringId === version.id ? "Restoring…" : "Restore this version"}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
