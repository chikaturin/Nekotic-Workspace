"use client";

import { useMemo } from "react";
import { isArchivedNode } from "@/lib/archive";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { resolvePath, sortNodes } from "@/lib/tree";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { BreadcrumbTrail, DriveLocation, DriveNode } from "@/types";

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
    // Archived items keep their place in the tree but stay out of the working
    // listing, whatever their kind — the Archive view surfaces them instead.
    // (Deleted ones are not in the tree at all; they live in the trash bin.)
    const visible = location.children.filter(
      (node) => !node.isTrashed && !isArchivedNode(node),
    );

    return {
      ...location,
      breadcrumbs,
      visibleChildren: sortNodes(visible, sort),
      dropTargetId: location.node?.id ?? null,
    };
  }, [tree, workspace, segments, sort]);
}
