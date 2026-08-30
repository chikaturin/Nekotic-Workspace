"use client";

import { useCallback, useMemo } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { scopeBoardsToFolder } from "@/lib/relation-scope";
import { findNodeById } from "@/lib/tree";
import { boardApi } from "@/services/api/board.api";
import { useBoardStore } from "@/store/board-store";
import {
  selectActiveWorkspace,
  selectFullTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { useVisibleTree } from "@/hooks/use-workspace-access";
import type { BoardDescriptor } from "@/services/board-types";

export function useBoardFolderId(): string | null {
  const nodeId = useBoardStore((state) => state.nodeId);

  return useWorkspaceStore((state) =>
    nodeId === null ? null : (findNodeById(selectFullTree(state), nodeId)?.parentId ?? null),
  );
}

export interface FolderBoard {
  readonly id: string;
  readonly nodeId: string;
  readonly name: string;
  readonly rowIdPrefix: string;
}

export interface FolderBoardsState {
  readonly boards: readonly FolderBoard[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

export function useFolderBoards(input: {
  readonly folderId: string | null;
  readonly currentNodeId: string;
  readonly allowSelf?: boolean;
}): FolderBoardsState {
  const { folderId, currentNodeId, allowSelf = false } = input;
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useVisibleTree();

  const loader = useCallback(
    (signal: AbortSignal) => boardApi.list(workspace.id, signal),
    [workspace.id],
  );

  const { state } = useAsyncResource<readonly BoardDescriptor[]>(loader, {
    keepPreviousData: true,
  });

  const boards = useMemo(
    () =>
      state.status === "success"
        ? scopeBoardsToFolder({
            boards: state.data.map((board) => ({
              id: board.boardId,
              nodeId: board.nodeId,
              name: board.name,
              rowIdPrefix: board.rowIdPrefix,
            })),
            tree,
            folderId,
            currentNodeId,
            allowSelf,
          })
        : [],
    [state, tree, folderId, currentNodeId, allowSelf],
  );

  return {
    boards,
    isLoading: state.status === "loading" || state.status === "idle",
    error: state.status === "error" ? state.error.message : null,
  };
}
