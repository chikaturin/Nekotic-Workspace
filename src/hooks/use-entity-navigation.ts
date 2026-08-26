"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { hrefForRef, opensDrawer } from "@/lib/entity-ref";
import { findPathToId } from "@/lib/tree";
import { useRecentStore } from "@/store/recent-store";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef } from "@/types";

/**
 * Open anything a notification, search hit or My Work card points at.
 *
 * One function so every entry point behaves identically: files open the
 * preview, records route to their board and then ask it to open the drawer,
 * everything else is a plain navigation. A target whose node has since been
 * deleted reports that instead of dropping the user at the drive root.
 */
export function useOpenEntity(): (ref: EntityRef) => void {
  const router = useRouter();
  const tree = useWorkspaceStore(selectTree);
  const requestRow = useWorkspaceStore((state) => state.requestRow);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const visit = useRecentStore((state) => state.visit);

  return useCallback(
    (ref: EntityRef) => {
      if (findPathToId(tree, ref.nodeId).length === 0) {
        pushFeedback(`“${ref.label}” is no longer in this workspace`, "error");
        return;
      }

      visit(ref);

      if (ref.kind === "file") {
        openPreview(ref.nodeId);
        return;
      }

      // The board reads this after it loads; the grid store resets per board.
      if (opensDrawer(ref)) requestRow(ref.nodeId, ref.rowId);

      router.push(hrefForRef(tree, ref));
    },
    [tree, router, requestRow, openPreview, pushFeedback, visit],
  );
}
