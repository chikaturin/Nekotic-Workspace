"use client";

import { useMemo } from "react";
import { isRowArchived } from "@/lib/archive";
import { useBoardPeople } from "@/hooks/use-board-people";
import type { CellContext } from "@/lib/cell-values";
import { buildGroups, type RowGroup } from "@/lib/board-grouping";
import {
  buildHierarchy,
  completionColumnOf,
  isSubtask,
  subtaskDisplayOf,
  type HierarchyIndex,
} from "@/lib/board-hierarchy";
import { queryRowIds, resolveColumns, visibleColumns } from "@/lib/board-view";
import { useRelationIndex } from "@/hooks/use-relation-index";
import { selectActiveView, useBoardStore } from "@/store/board-store";
import type { Board, BoardColumn, BoardColumnOf, SavedView, SubtaskDisplay } from "@/types";

export interface BoardViewModel {
  readonly board: Board | null;
  readonly view: SavedView | null;
  readonly columns: readonly BoardColumn[];
  readonly columnsShown: readonly BoardColumn[];
  readonly rowIds: readonly string[];
  readonly context: CellContext;
  readonly totalRows: number;
  readonly archivedRows: number;
  readonly isShowingArchived: boolean;
  readonly groupColumn: BoardColumn | null;
  readonly groups: readonly RowGroup[] | null;
  readonly dateColumn: BoardColumn | null;
  readonly endDateColumn: BoardColumn | null;
  readonly hierarchy: HierarchyIndex;
  readonly subtaskDisplay: SubtaskDisplay;
  readonly completionColumn: BoardColumnOf<"select"> | null;
}

export function useBoardView(): BoardViewModel {
  const board = useBoardStore((state) => state.board);
  const view = useBoardStore(selectActiveView);
  const rowsById = useBoardStore((state) => state.rowsById);
  const rowOrder = useBoardStore((state) => state.rowOrder);
  const people = useBoardPeople();
  const search = useBoardStore((state) => state.search);
  const isShowingArchived = useBoardStore((state) => state.isShowingArchived);

  const columns = useMemo(() => (board ? resolveColumns(board, view) : []), [board, view]);
  const columnsShown = useMemo(() => visibleColumns(columns), [columns]);

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const localLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const rowId of rowOrder) {
      const row = rowsById[rowId];
      if (row) labels.set(rowId, row.displayId);
    }
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on order; ids are immutable
  }, [rowOrder]);

  const relationRows = useMemo(
    () => rowOrder.map((rowId) => rowsById[rowId]).filter((row) => row !== undefined),
    [rowOrder, rowsById],
  );

  const relations = useRelationIndex({
    boardId: board?.id ?? "",
    columns,
    rows: relationRows,
  });

  const relationLabels = useMemo(() => {
    if (relations.labels.size === 0) return localLabels;
    return new Map([...localLabels, ...relations.labels]);
  }, [localLabels, relations.labels]);

  const context = useMemo<CellContext>(
    () => ({ people: peopleById, relationLabels, relationResolved: relations.isResolved }),
    [peopleById, relationLabels, relations.isResolved],
  );

  const queried = useMemo(
    () =>
      queryRowIds({
        view,
        rowsById,
        rowOrder,
        columns: columnsShown,
        context,
        search,
        includeArchived: isShowingArchived,
      }),
    [view, rowsById, rowOrder, columnsShown, context, search, isShowingArchived],
  );

  const hierarchy = useMemo(() => buildHierarchy(rowOrder, rowsById), [rowOrder, rowsById]);

  const subtaskDisplay = subtaskDisplayOf(view?.subtaskDisplay);

  const rowIds = useMemo(
    () =>
      subtaskDisplay === "hidden"
        ? queried.filter((rowId) => !isSubtask(rowsById[rowId]))
        : queried,
    [queried, subtaskDisplay, rowsById],
  );

  const completionColumn = useMemo(() => completionColumnOf(columns), [columns]);

  const archivedRows = useMemo(
    () => rowOrder.filter((rowId) => {
      const row = rowsById[rowId];
      return row ? isRowArchived(row) : false;
    }).length,
    [rowOrder, rowsById],
  );

  const byId = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);

  const groupColumn = view?.groupByColumnId ? byId.get(view.groupByColumnId) ?? null : null;
  const dateColumn = view?.dateColumnId ? byId.get(view.dateColumnId) ?? null : null;
  const endDateColumn = view?.endDateColumnId ? byId.get(view.endDateColumnId) ?? null : null;

  const isGrouped = groupColumn !== null && (view?.type === "kanban" || view?.groupByColumnId !== null);

  const groups = useMemo(
    () =>
      isGrouped && groupColumn
        ? buildGroups(rowIds, rowsById, groupColumn, context, {
            hideEmpty: view?.type === "kanban" ? false : view?.hideEmptyGroups,
          })
        : null,
    [isGrouped, groupColumn, rowIds, rowsById, context, view?.type, view?.hideEmptyGroups],
  );

  return {
    board,
    view,
    columns,
    columnsShown,
    rowIds,
    context,
    totalRows: rowOrder.length,
    archivedRows,
    isShowingArchived,
    groupColumn,
    groups,
    dateColumn,
    endDateColumn,
    hierarchy,
    subtaskDisplay,
    completionColumn,
  };
}
