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

/**
 * Files of one folder, wrapped in the async states the UI must handle.
 *
 * The request decides *whether* the folder can be read (access, latency,
 * failures); the rendered list then comes from the workspace tree, so an upload
 * or a favourite toggle shows up immediately instead of waiting for a refetch.
 */
export function useFileCatalog(folderId: string | null): FileCatalog {
  const tree = useWorkspaceStore(selectTree);

  const folder = useMemo(
    () => (folderId ? findNodeById(tree, folderId) : null),
    [tree, folderId],
  );

  const capabilities = useCapabilities(folder);
  const canView = capabilities.view;

  const loader = useCallback(
    (signal: AbortSignal) => fileService.listFiles({ folderId, canView, signal }),
    [folderId, canView],
  );

  const resource = useAsyncResource(loader, { keepPreviousData: true });

  const liveFiles = useMemo(
    () => visibleFilesOf(tree, folder) as readonly FileNode[],
    [folder, tree],
  );

  const state = useMemo<AsyncState<readonly FileNode[]>>(() => {
    if (resource.state.status !== "success") return resource.state;

    // A listing that genuinely came back empty stays empty; otherwise the live
    // tree is the display source.
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
