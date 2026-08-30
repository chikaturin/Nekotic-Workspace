"use client";

import { useMemo } from "react";
import {
  buildHierarchy,
  childIdsOf,
  completionColumnOf,
  isRowCompleted,
  subtaskProgress,
  type SubtaskProgress,
} from "@/lib/board-hierarchy";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn, BoardColumnOf, BoardRow } from "@/types";

export interface SubtaskEntry {
  readonly row: BoardRow;
  readonly isCompleted: boolean;
  readonly childCount: number;
}

export interface SubtaskView {
  readonly entries: readonly SubtaskEntry[];
  readonly progress: SubtaskProgress;
  readonly completionColumn: BoardColumnOf<"select"> | null;
}

const EMPTY: SubtaskView = {
  entries: [],
  progress: { total: 0, completed: 0, ratio: 0, percent: 0, isMeasurable: false },
  completionColumn: null,
};

export function useSubtasks(parentRowId: string | null, columns: readonly BoardColumn[]): SubtaskView {
  const rowsById = useBoardStore((state) => state.rowsById);
  const rowOrder = useBoardStore((state) => state.rowOrder);

  const hierarchy = useMemo(() => buildHierarchy(rowOrder, rowsById), [rowOrder, rowsById]);
  const completionColumn = useMemo(() => completionColumnOf(columns), [columns]);

  return useMemo(() => {
    if (!parentRowId) return EMPTY;

    const childIds = childIdsOf(hierarchy, parentRowId);

    const entries = childIds.flatMap<SubtaskEntry>((childId) => {
      const row = rowsById[childId];
      if (!row) return [];

      return [
        {
          row,
          isCompleted: isRowCompleted(row, completionColumn),
          childCount: childIdsOf(hierarchy, childId).length,
        },
      ];
    });

    return {
      entries,
      progress: subtaskProgress(childIds, rowsById, completionColumn),
      completionColumn,
    };
  }, [parentRowId, hierarchy, rowsById, completionColumn]);
}
