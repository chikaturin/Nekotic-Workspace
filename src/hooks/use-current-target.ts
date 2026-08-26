"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { DRIVE_ROOT_PATH, FILES_ROOT_PATH } from "@/config/app";
import { resolvePath } from "@/lib/tree";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isContainer } from "@/types";

export interface CurrentTarget {
  /** Container that create/upload actions write into — null means root. */
  readonly targetId: string | null;
  readonly targetName: string;
  readonly segments: readonly string[];
}

/** Path segments of the current drive route, or an empty list elsewhere. */
export function useDriveSegments(): readonly string[] {
  const pathname = usePathname();

  return useMemo(() => {
    const prefix = [DRIVE_ROOT_PATH, FILES_ROOT_PATH].find((candidate) =>
      pathname.startsWith(candidate),
    );
    if (!prefix) return [];

    return pathname
      .slice(prefix.length)
      .split("/")
      .filter((segment) => segment.length > 0)
      .map(decodeURIComponent);
  }, [pathname]);
}

/**
 * Resolve the folder the user is currently looking at. Used by the sidebar and
 * header so "New" and "Upload" always land in the visible location.
 */
export function useCurrentTarget(): CurrentTarget {
  const segments = useDriveSegments();
  const tree = useWorkspaceStore(selectTree);
  const workspace = useWorkspaceStore(selectActiveWorkspace);

  return useMemo(() => {
    const { node } = resolvePath(tree, segments);
    if (node && isContainer(node)) {
      return { targetId: node.id, targetName: node.name, segments };
    }
    return { targetId: null, targetName: workspace.name, segments };
  }, [tree, segments, workspace.name]);
}
