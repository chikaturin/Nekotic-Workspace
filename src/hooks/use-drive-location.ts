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
  readonly visibleChildren: readonly DriveNode[];
  readonly dropTargetId: string | null;
  readonly isDenied: boolean;
}

export function useDriveLocation(segments: readonly string[]): DriveLocationView {
  const tree = useWorkspaceStore(selectTree);
  const fullTree = useWorkspaceStore(selectFullTree);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const sort = useWorkspaceStore((state) => state.sort);

  return useMemo(() => {
    const location = resolvePath(tree, segments);
    const breadcrumbs = buildBreadcrumbs(workspace, tree, location.ancestors, location.node);
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
