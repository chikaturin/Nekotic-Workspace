"use client";

import { useMemo } from "react";
import { FilePreviewDialog } from "@/components/files/file-preview-dialog";
import { childrenOf, isFile, type DriveNode, type FileNode } from "@/types";
import { findNodeById, findPathToId } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";

/**
 * Connects the workspace-wide "preview this node" state to the shared file
 * preview surface, so the drive and the file manager show the same thing.
 */
export function DrivePreviewDialog() {
  const previewNodeId = useWorkspaceStore((state) => state.previewNodeId);
  const closePreview = useWorkspaceStore((state) => state.closePreview);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const tree = useWorkspaceStore(selectTree);

  const node = previewNodeId ? findNodeById(tree, previewNodeId) : null;
  const fileNode = node && isFile(node) ? node : null;

  const siblings = useMemo<readonly FileNode[]>(() => {
    if (!fileNode) return [];

    const path = findPathToId(tree, fileNode.id);
    const parent = path.length > 1 ? path[path.length - 2] : null;
    const pool: readonly DriveNode[] = parent ? childrenOf(parent) : tree;

    return pool.filter((item): item is FileNode => isFile(item) && !item.isTrashed);
  }, [fileNode, tree]);

  return (
    <FilePreviewDialog
      node={fileNode}
      siblings={siblings}
      onClose={closePreview}
      onSelect={openPreview}
    />
  );
}
