"use client";

import { useMemo } from "react";
import { isArchivedNode } from "@/lib/archive";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { resolvePath, sortNodes } from "@/lib/tree";
import {
  selectActiveWorkspace,
  selectFullTree,
  selectTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import type { BreadcrumbTrail, DriveLocation, DriveNode } from "@/types";

export interface DriveLocationView extends DriveLocation {
  readonly breadcrumbs: BreadcrumbTrail;
  /** Children after trashed-filtering and sorting — what the grid renders. */
  readonly visibleChildren: readonly DriveNode[];
  /** Parent id used as the default drop target for the current view. */
  readonly dropTargetId: string | null;
  /**
   * The path names something real that this person may not see.
   *
   * Distinguished from "not found" because the two want different screens, and
   * the refusal screen deliberately names nothing — knowing that *something* is
   * there is unavoidable once a URL resolves, knowing what it is called is not.
   */
  readonly isDenied: boolean;
}

/** Resolve URL segments against the active workspace tree. */
export function useDriveLocation(segments: readonly string[]): DriveLocationView {
  const tree = useWorkspaceStore(selectTree);
  const fullTree = useWorkspaceStore(selectFullTree);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const sort = useWorkspaceStore((state) => state.sort);

  return useMemo(() => {
    // Resolved against the tree this person is allowed to know, so a restricted
    // node is missing rather than merely disabled — and its name never reaches
    // the breadcrumbs, the sibling menus or the children listing.
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
      isDenied: location.isNotFound && !resolvePath(fullTree, segments).isNotFound,
    };
  }, [tree, fullTree, workspace, segments, sort]);
}
