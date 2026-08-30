"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { findNodeById } from "@/lib/tree";
import { fileService } from "@/services/file-service";
import { getActiveTree } from "@/store/workspace-store";
import { isFile, type AsyncState, type FileNode, type FilePreview } from "@/types";

export interface FilePreviewController {
  readonly state: AsyncState<FilePreview>;
  readonly reload: () => void;
  readonly download: () => Promise<void>;
}

const NO_SELECTION: FilePreview = { kind: "unsupported", reason: "No file selected" };

export function useFilePreview(nodeId: string | null): FilePreviewController {
  const loader = useCallback(
    (signal: AbortSignal) => {
      const node = resolveFile(nodeId);
      return node ? fileService.getPreview(node, signal) : Promise.resolve(NO_SELECTION);
    },
    [nodeId],
  );

  const resource = useAsyncResource(loader, { enabled: nodeId !== null });

  const download = useCallback(async () => {
    const node = resolveFile(nodeId);
    if (!node) return;

    const url = await fileService.getDownloadUrl(node);
    triggerDownload(url, node.name);
  }, [nodeId]);

  return { state: resource.state, reload: resource.reload, download };
}

export function useFileDownload(): (node: FileNode) => Promise<void> {
  return useCallback(async (node: FileNode) => {
    const url = await fileService.getDownloadUrl(node);
    triggerDownload(url, node.name);
  }, []);
}

function resolveFile(nodeId: string | null): FileNode | null {
  if (!nodeId) return null;

  const node = findNodeById(getActiveTree(), nodeId);
  return node && isFile(node) ? node : null;
}

function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
