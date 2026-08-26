"use client";

import { useCallback, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, VersionEntry } from "@/types";

const NO_ENTRIES: readonly VersionEntry[] = [];

export interface VersionSource {
  /** Where the history comes from — one call, already projected to entries. */
  readonly load: (signal: AbortSignal) => Promise<readonly VersionEntry[]>;
  /** Null when the subject cannot be restored (a secret has no snapshot). */
  readonly restore: ((versionId: string) => Promise<void>) | null;
  /** The content on screen now, as lines — the right-hand side of a compare. */
  readonly currentLines: readonly string[];
  readonly currentVersion: number;
  readonly canRestore: boolean;
}

export interface VersionHistoryOptions {
  /**
   * Only load while the history is on screen.
   *
   * A version list read at mount is stale by the time somebody opens it — the
   * page has been edited since. Tying the fetch to the dialog being open means
   * what is shown is what the service holds *now*.
   */
  readonly enabled: boolean;
}

export interface VersionHistory {
  readonly state: AsyncState<readonly VersionEntry[]>;
  readonly entries: readonly VersionEntry[];
  readonly currentLines: readonly string[];
  readonly currentVersion: number;
  readonly canRestore: boolean;
  readonly restoringId: string | null;
  readonly restore: (entry: VersionEntry) => Promise<void>;
  readonly reload: () => void;
}

/**
 * One history controller for pages, config files and secrets (SY-VER-39).
 *
 * Restoring writes a *new* version rather than rewinding, so the record of what
 * happened stays complete — which also means the list has to reload afterwards
 * rather than assume the entry it restored is now the top one.
 */
export function useVersionHistory(
  source: VersionSource,
  { enabled }: VersionHistoryOptions,
): VersionHistory {
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { state, reload } = useAsyncResource<readonly VersionEntry[]>(source.load, {
    enabled,
    keepPreviousData: true,
  });

  const restore = useCallback(
    async (entry: VersionEntry) => {
      if (!source.restore || !entry.hasSnapshot) return;

      setRestoringId(entry.id);

      try {
        await source.restore(entry.id);
        reload();
        pushFeedback(`Restored version ${entry.version}`, "success");
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setRestoringId(null);
      }
    },
    [source, reload, pushFeedback],
  );

  return {
    state,
    entries: state.status === "success" ? state.data : NO_ENTRIES,
    currentLines: source.currentLines,
    currentVersion: source.currentVersion,
    canRestore: source.canRestore && source.restore !== null,
    restoringId,
    restore,
    reload,
  };
}
