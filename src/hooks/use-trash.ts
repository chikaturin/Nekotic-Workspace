"use client";

import { useMemo } from "react";
import { MOCK_NOW } from "@/config/app";
import { daysRemaining, restoreTargetFor, sortTrash } from "@/lib/trash";
import { findNodeById } from "@/lib/tree";
import { selectTrash, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { TrashEntry } from "@/types";

/**
 * One row of the Trash view: the deleted item, where it came from, who removed
 * it and when it is due to be swept — plus, resolved up front, whether putting
 * it back would land it somewhere new.
 */
export interface TrashRow {
  readonly entry: TrashEntry;
  readonly daysLeft: number | null;
  /** True when the original folder is gone and a restore has to relocate. */
  readonly willRelocate: boolean;
  readonly restoreLocation: string;
}

export function useTrash(): readonly TrashRow[] {
  const entries = useWorkspaceStore(selectTrash);
  const tree = useWorkspaceStore(selectTree);

  return useMemo(
    () =>
      sortTrash(entries).map((entry) => {
        const target = restoreTargetFor(tree, entry);
        const parent = target.parentId ? findNodeById(tree, target.parentId) : null;

        return {
          entry,
          daysLeft: daysRemaining(entry.deletedAt, MOCK_NOW),
          willRelocate: target.isRelocated,
          restoreLocation: parent?.name ?? "Workspace",
        };
      }),
    [entries, tree],
  );
}
