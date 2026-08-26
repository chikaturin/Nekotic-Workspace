"use client";

import { useMemo } from "react";
import { isRowArchived } from "@/lib/archive";
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
  /** Every column in view order, hidden ones included. */
  readonly columns: readonly BoardColumn[];
  readonly columnsShown: readonly BoardColumn[];
  /** Row ids after filters, search and sort — the order every view renders. */
  readonly rowIds: readonly string[];
  readonly context: CellContext;
  readonly totalRows: number;
  /** Records frozen out of the views — the count the toolbar toggle shows. */
  readonly archivedRows: number;
  readonly isShowingArchived: boolean;
  /** Column the view groups by, when it groups at all. */
  readonly groupColumn: BoardColumn | null;
  /** Groups over `rowIds`; null when the view is ungrouped. */
  readonly groups: readonly RowGroup[] | null;
  /** Anchors for the calendar and the timeline. */
  readonly dateColumn: BoardColumn | null;
  readonly endDateColumn: BoardColumn | null;
  /**
   * Parent/child index over the whole board — built from `rowOrder`, not from
   * `rowIds`, so a parent filtered out of this view is still known to be the
   * parent of the children that survived it.
   */
  readonly hierarchy: HierarchyIndex;
  /** How this view reads that hierarchy. */
  readonly subtaskDisplay: SubtaskDisplay;
  /** Select column whose configured options mean "finished", if any. */
  readonly completionColumn: BoardColumnOf<"select"> | null;
}

/**
 * The one query the board runs. Table, Kanban, Calendar and Timeline all take
 * their rows from here, which is what keeps the views in sync by construction.
 */
export function useBoardView(): BoardViewModel {
  const board = useBoardStore((state) => state.board);
  const view = useBoardStore(selectActiveView);
  const rowsById = useBoardStore((state) => state.rowsById);
  const rowOrder = useBoardStore((state) => state.rowOrder);
  const people = useBoardStore((state) => state.people);
  const search = useBoardStore((state) => state.search);
  const isShowingArchived = useBoardStore((state) => state.isShowingArchived);

  const columns = useMemo(() => (board ? resolveColumns(board, view) : []), [board, view]);
  const columnsShown = useMemo(() => visibleColumns(columns), [columns]);

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  /**
   * Relation chips render the target's display id, which never changes — so
   * this map only has to be rebuilt when rows are added or removed, not on
   * every cell edit.
   */
  const localLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const rowId of rowOrder) {
      const row = rowsById[rowId];
      if (row) labels.set(rowId, row.displayId);
    }
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on order; ids are immutable
  }, [rowOrder]);

  /** Cross-board relation targets, resolved one board at a time. */
  const relations = useRelationIndex(columns);

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

  /**
   * The hierarchy is indexed over the board, not over the query: a child whose
   * parent a filter removed still needs to know it has one.
   */
  const hierarchy = useMemo(() => buildHierarchy(rowOrder, rowsById), [rowOrder, rowsById]);

  const subtaskDisplay = subtaskDisplayOf(view?.subtaskDisplay);

  /**
   * "Hide subtasks" is a property of the view, so it is applied here — before
   * grouping, before Kanban columns, before the calendar. Every surface then
   * reads one list of ids and none of them has to know about the hierarchy.
   */
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

  // Kanban always groups; the table only groups when the view asks for it.
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
