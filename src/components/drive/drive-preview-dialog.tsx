"use client";

import { useMemo } from "react";
import { FilePreviewDialog } from "@/components/files/file-preview-dialog";
import { useTrackRecent } from "@/hooks/use-recent";
import { nodeRef } from "@/lib/entity-ref";
import { isFile } from "@/types";
import { findNodeById } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";

/**
 * Connects the workspace-wide "preview this node" state to the shared file
 * preview surface, so the drive and the file manager show the same thing.
 */
export function DrivePreviewDialog() {
  const previewNodeId = useWorkspaceStore((state) => state.previewNodeId);
  const closePreview = useWorkspaceStore((state) => state.closePreview);
  const tree = useWorkspaceStore(selectTree);

  const node = previewNodeId ? findNodeById(tree, previewNodeId) : null;
  const fileNode = node && isFile(node) ? node : null;

  // Previewing a file is opening it, so it belongs in Recent.
  useTrackRecent(useMemo(() => (fileNode ? nodeRef(fileNode) : null), [fileNode]));

  return <FilePreviewDialog node={fileNode} onClose={closePreview} />;
}
