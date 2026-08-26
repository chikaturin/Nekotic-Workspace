"use client";

import { useCallback, useMemo, useState } from "react";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { isRowArchived } from "@/lib/archive";
import { lensesFor } from "@/lib/my-work";
import { useBoardStore } from "@/store/board-store";
import { selectSelectedRowIds, useGridStore } from "@/store/grid-store";
import type { BoardColumnOf, CellValue } from "@/types";

/**
 * The selection, and what may be done to it (SY-BLK-34).
 *
 * Every action here calls *one* endpoint with the whole list of ids. That is
 * not an optimisation — it is what makes partial success expressible: a loop of
 * single-row writes could only report the first failure.
 */

export interface BulkActionsController {
  readonly selectedIds: readonly string[];
  readonly count: number;
  /** How many of the selected records are frozen and will be skipped. */
  readonly archivedCount: number;
  readonly isRunning: boolean;
  /** Columns the status and assignee actions write to, resolved by role. */
  readonly statusColumn: BoardColumnOf<"select"> | null;
  readonly assigneeColumn: BoardColumnOf<"user"> | null;
  readonly clear: () => void;
  readonly selectAll: () => void;
  readonly setStatus: (optionId: string | null) => Promise<void>;
  readonly assign: (userIds: readonly string[]) => Promise<void>;
  readonly move: (targetNodeId: string, targetName: string) => Promise<void>;
  readonly setArchived: (isArchived: boolean) => Promise<void>;
  readonly remove: () => Promise<void>;
}

export function useBulkActions(model: BoardViewModel): BulkActionsController {
  const selectedMap = useGridStore(selectSelectedRowIds);
  const clearRowSelection = useGridStore((state) => state.clearRowSelection);
  const setRowSelection = useGridStore((state) => state.setRowSelection);

  const rowsById = useBoardStore((state) => state.rowsById);
  const bulkUpdate = useBoardStore((state) => state.bulkUpdate);
  const bulkArchive = useBoardStore((state) => state.bulkArchive);
  const bulkDelete = useBoardStore((state) => state.bulkDelete);
  const bulkMove = useBoardStore((state) => state.bulkMove);

  const [isRunning, setIsRunning] = useState(false);

  /**
   * Ticks can outlive their records — a delete or a move leaves stale ids
   * behind. They are filtered here so a stale id never reaches a write.
   */
  const selectedIds = useMemo(
    () => Object.keys(selectedMap).filter((rowId) => rowsById[rowId] !== undefined),
    [selectedMap, rowsById],
  );

  const archivedCount = useMemo(
    () => selectedIds.filter((rowId) => {
      const row = rowsById[rowId];
      return row ? isRowArchived(row) : false;
    }).length,
    [selectedIds, rowsById],
  );

  const lenses = useMemo(() => (model.board ? lensesFor(model.board) : null), [model.board]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setIsRunning(true);
      try {
        await action();
        clearRowSelection();
      } finally {
        setIsRunning(false);
      }
    },
    [clearRowSelection],
  );

  const write = useCallback(
    (columnId: string, value: CellValue, verb: string) =>
      run(() => bulkUpdate(selectedIds, { [columnId]: value }, verb)),
    [run, bulkUpdate, selectedIds],
  );

  return {
    selectedIds,
    count: selectedIds.length,
    archivedCount,
    isRunning,
    statusColumn: lenses?.status ?? null,
    assigneeColumn: lenses?.assignee ?? null,

    clear: clearRowSelection,
    selectAll: useCallback(() => setRowSelection(model.rowIds), [setRowSelection, model.rowIds]),

    setStatus: useCallback(
      (optionId) => {
        const column = lenses?.status;
        if (!column) return Promise.resolve();

        return write(
          column.id,
          { kind: "select", optionIds: optionId ? [optionId] : [] },
          "Updated",
        );
      },
      [lenses, write],
    ),

    assign: useCallback(
      (userIds) => {
        const column = lenses?.assignee;
        if (!column) return Promise.resolve();

        return write(column.id, { kind: "user", userIds: [...userIds] }, "Assigned");
      },
      [lenses, write],
    ),

    move: useCallback(
      (targetNodeId, targetName) => run(() => bulkMove(selectedIds, targetNodeId, targetName)),
      [run, bulkMove, selectedIds],
    ),

    setArchived: useCallback(
      (isArchived) => run(() => bulkArchive(selectedIds, isArchived)),
      [run, bulkArchive, selectedIds],
    ),

    remove: useCallback(() => run(() => bulkDelete(selectedIds)), [run, bulkDelete, selectedIds]),
  };
}
