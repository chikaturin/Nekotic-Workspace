"use client";

import { useCallback, useMemo } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import {
  applyCellEdits,
  captureCells,
  indexRows,
  reconcileRows,
  revertCellEdits,
  type RowMap,
} from "@/lib/board-records";
import { queryRowIds, resolveColumns, visibleColumns } from "@/lib/board-view";
import type { CellContext } from "@/lib/cell-values";
import { boardService } from "@/services/board-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  Board,
  BoardColumn,
  BoardSnapshot,
  CellValue,
  SavedView,
} from "@/types";

export type EmbedStatus = "loading" | "ready" | "missing" | "error";

export interface EmbeddedBoard {
  readonly status: EmbedStatus;
  readonly message: string | null;
  readonly board: Board | null;
  readonly view: SavedView | null;
  readonly columns: readonly BoardColumn[];
  readonly rowIds: readonly string[];
  readonly rowsById: RowMap;
  readonly context: CellContext;
  readonly editCell: (rowId: string, columnId: string, value: CellValue) => Promise<void>;
  readonly reload: () => void;
}

const EMPTY_ROWS: RowMap = {};

/**
 * DV-EMB-25 — a saved view of another board, rendered inside a document.
 *
 * Nothing is copied into the document: the block stores a board node id and a
 * view id, and the records come from the board service on demand. Reads run
 * through the same query the board itself uses, and writes go straight back to
 * the source board, so the embed cannot drift from it.
 */
export function useEmbeddedBoard(
  nodeId: string | null,
  viewId: string | null,
): EmbeddedBoard {
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  const loader = useCallback(
    (signal: AbortSignal) => {
      if (!nodeId) return Promise.reject(new Error("No board selected"));
      return boardService.getBoard(nodeId, signal);
    },
    [nodeId],
  );

  const resource = useAsyncResource<BoardSnapshot>(loader, { enabled: nodeId !== null });
  const snapshot = resource.state.status === "success" ? resource.state.data : null;

  const index = useMemo(() => (snapshot ? indexRows(snapshot.rows) : null), [snapshot]);

  const view = useMemo<SavedView | null>(() => {
    if (!snapshot) return null;
    return snapshot.board.views.find((candidate) => candidate.id === viewId) ?? snapshot.board.views[0] ?? null;
  }, [snapshot, viewId]);

  const columns = useMemo(
    () => (snapshot ? visibleColumns(resolveColumns(snapshot.board, view)) : []),
    [snapshot, view],
  );

  const context = useMemo<CellContext>(
    () => ({ people: new Map((snapshot?.people ?? []).map((person) => [person.id, person])) }),
    [snapshot],
  );

  const rowIds = useMemo(
    () =>
      index
        ? queryRowIds({
            view,
            rowsById: index.rowsById,
            rowOrder: index.rowOrder,
            columns,
            context,
          })
        : [],
    [index, view, columns, context],
  );

  /**
   * Writes take the same three beats as the board's own store — optimistic,
   * request, reconcile or roll back — reusing the very same pure operations.
   */
  const editCell = useCallback(
    async (rowId: string, columnId: string, value: CellValue) => {
      if (!snapshot || !index) return;

      const edits = [{ rowId, columnId, value }];
      const reverts = captureCells(index.rowsById, edits);
      const optimistic = applyCellEdits(index.rowsById, edits, new Date().toISOString());

      const write = (rows: RowMap) =>
        resource.setData({
          ...snapshot,
          rows: index.rowOrder.map((id) => rows[id]).filter((row) => row !== undefined),
        });

      write(optimistic);

      try {
        const result = await boardService.updateCells({
          boardId: snapshot.board.id,
          edits,
          baseRevisions: { [rowId]: index.rowsById[rowId]?.revision ?? 0 },
        });

        write(reconcileRows(optimistic, result.rows));
      } catch (error) {
        write(revertCellEdits(optimistic, reverts));
        pushFeedback(toAppError(error).message, "error");
      }
    },
    [snapshot, index, resource, pushFeedback],
  );

  const status: EmbedStatus = !nodeId
    ? "missing"
    : resource.state.status === "success"
      ? "ready"
      : resource.state.status === "error"
        ? resource.state.error.code === "not_found"
          ? "missing"
          : "error"
        : "loading";

  return {
    status,
    message: resource.state.status === "error" ? resource.state.error.message : null,
    board: snapshot?.board ?? null,
    view,
    columns,
    rowIds,
    rowsById: index?.rowsById ?? EMPTY_ROWS,
    context,
    editCell,
    reload: resource.reload,
  };
}
