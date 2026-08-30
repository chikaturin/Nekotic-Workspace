"use client";

import { useCallback, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, VersionEntry } from "@/types";

const NO_ENTRIES: readonly VersionEntry[] = [];

export interface VersionSource {
  readonly load: (signal: AbortSignal) => Promise<readonly VersionEntry[]>;
  readonly restore: ((versionId: string) => Promise<void>) | null;
  readonly currentLines: readonly string[];
  readonly currentVersion: number;
  readonly canRestore: boolean;
}

export interface VersionHistoryOptions {
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
