"use client";

import { useCallback } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
import { hrefForRef, opensDrawer } from "@/lib/entity-ref";
import { findPathToId } from "@/lib/tree";
import { useRecentStore } from "@/store/recent-store";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef } from "@/types";

export function useOpenEntity(): (ref: EntityRef) => void {
  const openNode = useOpenNode();
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

      if (opensDrawer(ref)) requestRow(ref.nodeId, ref.rowId);

      openNode(hrefForRef(tree, ref));
    },
    [tree, openNode, requestRow, openPreview, pushFeedback, visit],
  );
}
