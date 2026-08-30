"use client";

import { useCallback, useMemo } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useCapabilities } from "@/hooks/use-permissions";
import { findNodeById, visibleFilesOf } from "@/lib/tree";
import { fileService } from "@/services/file-service";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import {
  successState,
  type AsyncState,
  type CapabilitySet,
  type DriveNode,
  type FileNode,
} from "@/types";

export interface FileCatalog {
  readonly state: AsyncState<readonly FileNode[]>;
  readonly isRefreshing: boolean;
  readonly folder: DriveNode | null;
  readonly capabilities: CapabilitySet;
  readonly reload: () => void;
}

export function useFileCatalog(folderId: string | null): FileCatalog {
  const tree = useWorkspaceStore(selectTree);

  const folder = useMemo(
    () => (folderId ? findNodeById(tree, folderId) : null),
    [tree, folderId],
  );

  const capabilities = useCapabilities(folder);
  const canView = capabilities.view;

  const loader = useCallback(
    (signal: AbortSignal) =>
      folderId === null
        ? Promise.resolve([])
        : fileService.listFiles({ folderId, signal }),
    [folderId],
  );

  const resource = useAsyncResource(loader, {
    enabled: canView,
    keepPreviousData: true,
  });

  const liveFiles = useMemo(
    () => visibleFilesOf(tree, folder) as readonly FileNode[],
    [folder, tree],
  );

  const state = useMemo<AsyncState<readonly FileNode[]>>(() => {
    if (resource.state.status !== "success") return resource.state;

    return resource.state.data.length === 0 ? resource.state : successState(liveFiles);
  }, [resource.state, liveFiles]);

  return {
    state,
    isRefreshing: resource.isRefreshing,
    folder,
    capabilities,
    reload: resource.reload,
  };
}
