"use client";

import { useMemo } from "react";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { resolvePath, sortNodes } from "@/lib/tree";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isDocument, type BreadcrumbTrail, type DriveLocation, type DriveNode } from "@/types";

export interface DriveLocationView extends DriveLocation {
  readonly breadcrumbs: BreadcrumbTrail;
  /** Children after trashed-filtering and sorting — what the grid renders. */
  readonly visibleChildren: readonly DriveNode[];
  /** Parent id used as the default drop target for the current view. */
  readonly dropTargetId: string | null;
}

/** Resolve URL segments against the active workspace tree. */
export function useDriveLocation(segments: readonly string[]): DriveLocationView {
  const tree = useWorkspaceStore(selectTree);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const sort = useWorkspaceStore((state) => state.sort);

  return useMemo(() => {
    const location = resolvePath(tree, segments);
    const breadcrumbs = buildBreadcrumbs(workspace, tree, location.ancestors, location.node);
    // Trashed and archived items keep their place in the tree but stay out of
    // the folder listing — Trash and Archive surface them instead.
    const visible = location.children.filter(
      (node) => !node.isTrashed && !(isDocument(node) && node.isArchived),
    );

    return {
      ...location,
      breadcrumbs,
      visibleChildren: sortNodes(visible, sort),
      dropTargetId: location.node?.id ?? null,
    };
  }, [tree, workspace, segments, sort]);
}
