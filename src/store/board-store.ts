"use client";

import { create } from "zustand";
import {
  applyCellEdits,
  captureCells,
  copyCells,
  indexRows,
  reconcileRows,
  removeRow,
  removeRows,
  replaceRow,
  revertCellEdits,
  type RowMap,
} from "@/lib/board-records";
import { findColumnByName, insertColumnAt } from "@/lib/board-schema";
import { bulkTone, describeBulkResult } from "@/lib/bulk";
import { emptyCellFor } from "@/lib/cell-values";
import { wouldCreateCycle } from "@/lib/board-hierarchy";
import { guardCellEdits } from "@/lib/board-write-rules";
import { pruneView, reorderViews } from "@/lib/board-view";
import type { CellContext } from "@/lib/cell-values";
import { boardService } from "@/services/board-service";
import type { ImportRowsInput, ImportRowsResult } from "@/services/board-types";
import { isCancellation, toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  AppError,
  Board,
  BoardColumn,
  BoardRow,
  BoardViewType,
  BulkMoveResult,
  BulkResult,
  CellDisplayMode,
  CellEdit,
  CellValue,
  ColumnPatch,
  ColumnType,
  ConflictNotice,
  DirectoryUser,
  FilterConjunction,
  RowHeight,
  SavedView,
  SelectOption,
  GanttZoom,
  SubtaskDisplay,
  ViewFilter,
  ViewSort,
} from "@/types";
import { currentUser } from "@/store/session-store";

type BoardStatus = "idle" | "loading" | "ready" | "error";

interface BoardState {
  readonly nodeId: string | null;
  readonly status: BoardStatus;
  readonly error: AppError | null;
  readonly board: Board | null;
  readonly rowsById: RowMap;
  readonly rowOrder: readonly string[];
  readonly people: readonly DirectoryUser[];
  readonly activeViewId: string | null;
  readonly search: string;
  readonly pendingWrites: number;
  readonly conflicts: readonly ConflictNotice[];
  readonly isShowingArchived: boolean;
}

interface BoardActions {
  load: (nodeId: string) => Promise<void>;
  clear: () => void;
  reload: () => Promise<void>;
  setActiveView: (viewId: string) => void;
  setSearch: (query: string) => void;
  dismissConflict: (id: string) => void;

  setShowArchived: (show: boolean) => void;

  editCells: (edits: readonly CellEdit[]) => Promise<void>;

  bulkUpdate: (rowIds: readonly string[], values: Readonly<Record<string, CellValue>>, verb?: string) => Promise<BulkResult | null>;
  bulkArchive: (rowIds: readonly string[], isArchived: boolean) => Promise<BulkResult | null>;
  bulkDelete: (rowIds: readonly string[]) => Promise<BulkResult | null>;
  bulkMove: (rowIds: readonly string[], targetNodeId: string, targetName: string) => Promise<BulkMoveResult | null>;
  importRows: (
    input: Omit<ImportRowsInput, "boardId">,
  ) => Promise<ImportRowsResult | null>;
  addRow: (afterRowId?: string | null) => Promise<string | null>;
  duplicateRow: (rowId: string) => Promise<string | null>;
  deleteRow: (rowId: string) => Promise<void>;

  createSubtask: (
    parentRowId: string,
    values?: Readonly<Record<string, CellValue>>,
  ) => Promise<string | null>;
  setRowParent: (rowId: string, parentRowId: string | null) => Promise<boolean>;

  addColumn: (
    type: ColumnType,
    name: string,
    atIndex?: number,
    config?: BoardColumn["config"],
  ) => Promise<BoardColumn | null>;
  duplicateColumn: (columnId: string) => Promise<BoardColumn | null>;
  renameColumn: (columnId: string, name: string) => Promise<boolean>;
  updateColumnConfig: (columnId: string, patch: ColumnPatch) => Promise<void>;
  convertColumn: (columnId: string, type: ColumnType) => Promise<number>;
  deleteColumn: (columnId: string) => Promise<void>;
  createOption: (columnId: string, label: string) => Promise<SelectOption | null>;

  setSort: (columnId: string, direction: "asc" | "desc" | null) => Promise<void>;

  setSorts: (sorts: readonly ViewSort[]) => Promise<void>;
  setFilters: (filters: readonly ViewFilter[]) => Promise<void>;
  setFilterConjunction: (conjunction: FilterConjunction) => Promise<void>;
  setGroupBy: (columnId: string | null) => Promise<void>;
  setHideEmptyGroups: (hide: boolean) => Promise<void>;
  setDateColumn: (columnId: string | null) => Promise<void>;
  setEndDateColumn: (columnId: string | null) => Promise<void>;
  setViewType: (type: BoardViewType) => Promise<void>;
  setRowHeight: (rowHeight: RowHeight) => Promise<void>;
  setSubtaskDisplay: (display: SubtaskDisplay) => Promise<void>;
  setGanttZoom: (zoom: GanttZoom) => Promise<void>;
  setShowDependencies: (showDependencies: boolean) => Promise<void>;

  createView: (name: string, type: BoardViewType) => Promise<string | null>;
  duplicateView: (viewId: string) => Promise<string | null>;
  renameView: (viewId: string, name: string) => Promise<void>;
  moveViewTo: (viewId: string, toIndex: number) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;

  resizeColumn: (columnId: string, width: number) => void;
  commitColumnWidth: (columnId: string, width: number) => Promise<void>;
  setColumnHidden: (columnId: string, hidden: boolean) => Promise<void>;
  moveColumnTo: (columnId: string, toIndex: number) => Promise<void>;
  setColumnDisplay: (columnId: string, mode: CellDisplayMode) => Promise<void>;
}

export type BoardStore = BoardState & BoardActions;

const INITIAL: BoardState = {
  nodeId: null,
  status: "idle",
  error: null,
  board: null,
  rowsById: {},
  rowOrder: [],
  people: [],
  activeViewId: null,
  search: "",
  pendingWrites: 0,
  conflicts: [],
  isShowingArchived: false,
};

let loadToken = 0;

export const useBoardStore = create<BoardStore>()((set, get) => {
  const feedback = (message: string, tone: "info" | "success" | "error" = "error") =>
    useWorkspaceStore.getState().pushFeedback(message, tone);

  const report = (result: BulkResult, verb: string) =>
    feedback(describeBulkResult(result, verb), bulkTone(result));

  async function write<T>(request: () => Promise<T>, onError: () => void): Promise<T | null> {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));

    try {
      return await request();
    } catch (error) {
      const appError = toAppError(error);
      onError();
      if (!isCancellation(appError)) feedback(appError.message);
      return null;
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  }

  function currentBoard(): Board | null {
    return get().board;
  }

  function writeContext(): CellContext {
    const { people, rowsById, rowOrder } = get();
    const relationLabels = new Map<string, string>();
    for (const rowId of rowOrder) {
      const row = rowsById[rowId];
      if (row) relationLabels.set(rowId, row.displayId);
    }

    return {
      people: new Map(people.map((person) => [person.id, person])),
      relationLabels,
      relationResolved: false,
    };
  }

  function patchView(viewId: string, patch: Partial<SavedView>): void {
    set((state) => {
      if (!state.board) return state;

      return {
        board: {
          ...state.board,
          views: state.board.views.map((view) =>
            view.id === viewId ? { ...view, ...patch } : view,
          ),
        },
      };
    });
  }

  async function patchActiveView(
    patch: Partial<SavedView>,
    rollback: (view: SavedView) => Partial<SavedView>,
  ): Promise<void> {
    const board = currentBoard();
    const view = activeView();
    if (!board || !view) return;

    patchView(view.id, patch);

    await write(
      () => boardService.updateView(board.id, view.id, patch),
      () => patchView(view.id, rollback(view)),
    );
  }

  function activeView(): SavedView | null {
    const { board, activeViewId } = get();
    return board?.views.find((view) => view.id === activeViewId) ?? board?.views[0] ?? null;
  }

  return {
    ...INITIAL,

    load: async (nodeId) => {
      const token = (loadToken += 1);
      set({ ...INITIAL, nodeId, status: "loading" });

      try {
        const snapshot = await boardService.getBoard(nodeId);
        if (token !== loadToken) return;

        const { rowsById, rowOrder } = indexRows(snapshot.rows);
        set({
          status: "ready",
          board: snapshot.board,
          rowsById,
          rowOrder,
          people: snapshot.people,
          activeViewId: snapshot.board.views[0]?.id ?? null,
          error: null,
        });
      } catch (error) {
        if (token !== loadToken) return;

        const appError = toAppError(error);

        // Server nói mục này không còn: gỡ nó khỏi thanh điều hướng luôn, đừng
        // để nó tiếp tục mời người dùng bấm vào một trang báo lỗi.
        if (appError.code === "not_found") {
          useWorkspaceStore.getState().forgetMissingNode(nodeId);
        }

        set({ status: "error", error: appError });
      }
    },

    reload: async () => {
      const { nodeId } = get();
      if (nodeId) await get().load(nodeId);
    },

    clear: () => set({ ...INITIAL }),

    setActiveView: (viewId) => set({ activeViewId: viewId }),
    setSearch: (query) => set({ search: query }),
    setShowArchived: (show) => set({ isShowingArchived: show }),
    dismissConflict: (id) =>
      set((state) => ({ conflicts: state.conflicts.filter((conflict) => conflict.id !== id) })),

    editCells: async (rawEdits) => {
      const board = currentBoard();
      if (!board || rawEdits.length === 0) return;

      const { allowed: edits, rejected } = guardCellEdits({
        edits: rawEdits,
        board,
        rowsById: get().rowsById,
        context: writeContext(),
      });

      for (const rejection of rejected) feedback(rejection.message);
      if (edits.length === 0) return;

      const before = get().rowsById;
      const reverts = captureCells(before, edits);
      const baseRevisions = Object.fromEntries(
        reverts.map((revert) => [revert.rowId, before[revert.rowId]?.revision ?? 0]),
      );

      set({ rowsById: applyCellEdits(before, edits, new Date().toISOString()) });

      const result = await write(
        () => boardService.updateCells({ boardId: board.id, edits, baseRevisions }),
        () => set((state) => ({ rowsById: revertCellEdits(state.rowsById, reverts) })),
      );

      if (!result) return;

      set((state) => ({
        rowsById: reconcileRows(state.rowsById, result.rows),
        conflicts: [...state.conflicts, ...result.conflicts],
      }));
    },

    addRow: async (afterRowId = null) => {
      const board = currentBoard();
      if (!board) return null;

      const tempId = `tmp_${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const optimistic: BoardRow = {
        id: tempId,
        boardId: board.id,
        displayId: `${board.rowIdPrefix}-…`,
        sequence: 0,
        cells: Object.fromEntries(
          board.columns.map((column) => [column.id, emptyCellFor(column.type)]),
        ),
        createdAt: now,
        updatedAt: now,
        createdBy: currentUser().id,
        revision: 0,
        isPending: true,
      };

      const index = afterRowId ? get().rowOrder.indexOf(afterRowId) + 1 : get().rowOrder.length;
      set((state) => ({
        rowsById: { ...state.rowsById, [tempId]: optimistic },
        rowOrder: [
          ...state.rowOrder.slice(0, index),
          tempId,
          ...state.rowOrder.slice(index),
        ],
      }));

      const created = await write(
        () => boardService.createRow({ boardId: board.id, afterRowId }),
        () => set((state) => removeRow(state, tempId)),
      );

      if (!created) return null;

      set((state) => replaceRow(state, tempId, created));
      return created.id;
    },

    duplicateRow: async (rowId) => {
      const board = currentBoard();
      const source = get().rowsById[rowId];
      if (!board || !source) return null;

      const tempId = `tmp_${Date.now().toString(36)}`;
      const optimistic: BoardRow = {
        ...source,
        id: tempId,
        displayId: `${board.rowIdPrefix}-…`,
        sequence: 0,
        cells: copyCells(source),
        revision: 0,
        isPending: true,
      };

      const index = get().rowOrder.indexOf(rowId) + 1;
      set((state) => ({
        rowsById: { ...state.rowsById, [tempId]: optimistic },
        rowOrder: [...state.rowOrder.slice(0, index), tempId, ...state.rowOrder.slice(index)],
      }));

      const created = await write(
        () => boardService.duplicateRow(board.id, rowId),
        () => set((state) => removeRow(state, tempId)),
      );

      if (!created) return null;

      set((state) => replaceRow(state, tempId, created));
      return created.id;
    },

    deleteRow: async (rowId) => {
      const board = currentBoard();
      const row = get().rowsById[rowId];
      if (!board || !row) return;

      const index = get().rowOrder.indexOf(rowId);
      set((state) => removeRow(state, rowId));

      await write(
        () => boardService.deleteRow(board.id, rowId),
        () =>
          set((state) => ({
            rowsById: { ...state.rowsById, [rowId]: row },
            rowOrder: [
              ...state.rowOrder.slice(0, index),
              rowId,
              ...state.rowOrder.slice(index),
            ],
          })),
      );
    },

    createSubtask: async (parentRowId, values) => {
      const board = currentBoard();
      const parent = get().rowsById[parentRowId];
      if (!board || !parent) return null;

      const tempId = `tmp_${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const optimistic: BoardRow = {
        id: tempId,
        boardId: board.id,
        displayId: `${board.rowIdPrefix}-…`,
        sequence: 0,
        cells: {
          ...Object.fromEntries(
            board.columns.map((column) => [column.id, emptyCellFor(column.type)]),
          ),
          ...values,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: currentUser().id,
        revision: 0,
        parentRowId,
        isPending: true,
      };

      const index = get().rowOrder.indexOf(parentRowId) + 1;
      set((state) => ({
        rowsById: { ...state.rowsById, [tempId]: optimistic },
        rowOrder: [
          ...state.rowOrder.slice(0, index),
          tempId,
          ...state.rowOrder.slice(index),
        ],
      }));

      const created = await write(
        () =>
          boardService.createRow({
            boardId: board.id,
            parentRowId,
            ...(values ? { cells: optimistic.cells } : {}),
          }),
        () => set((state) => removeRow(state, tempId)),
      );

      if (!created) return null;

      set((state) => replaceRow(state, tempId, created));
      return created.id;
    },

    setRowParent: async (rowId, parentRowId) => {
      const board = currentBoard();
      const row = get().rowsById[rowId];
      if (!board || !row) return false;
      if ((row.parentRowId ?? null) === parentRowId) return true;

      if (wouldCreateCycle(get().rowsById, rowId, parentRowId)) {
        feedback("That would put a record inside itself");
        return false;
      }

      const previous = row.parentRowId ?? null;
      set((state) => ({
        rowsById: { ...state.rowsById, [rowId]: { ...row, parentRowId } },
      }));

      const updated = await write(
        () => boardService.setRowParent(board.id, rowId, parentRowId),
        () =>
          set((state) => {
            const current = state.rowsById[rowId];
            return current
              ? { rowsById: { ...state.rowsById, [rowId]: { ...current, parentRowId: previous } } }
              : state;
          }),
      );

      if (!updated) return false;

      set((state) => ({ rowsById: reconcileRows(state.rowsById, [updated]) }));
      return true;
    },

    bulkUpdate: async (rowIds, values, verb = "Updated") => {
      const board = currentBoard();
      if (!board || rowIds.length === 0) return null;

      const { rejected } = guardCellEdits({
        edits: rowIds.flatMap((rowId) =>
          Object.entries(values).map(([columnId, value]) => ({ rowId, columnId, value })),
        ),
        board,
        rowsById: get().rowsById,
        context: writeContext(),
      });

      const blocked = new Set(rejected.map((rejection) => rejection.edit.rowId));
      const targets = rowIds.filter((rowId) => !blocked.has(rowId));

      if (blocked.size > 0) {
        feedback(
          `${blocked.size} record${blocked.size === 1 ? "" : "s"} could not make that change — ${rejected[0]?.message ?? ""}`,
        );
      }

      if (targets.length === 0) return null;

      const result = await write(
        () => boardService.bulkUpdate({ boardId: board.id, rowIds: targets, values }),
        () => {},
      );
      if (!result) return null;

      set((state) => ({ rowsById: reconcileRows(state.rowsById, result.rows) }));
      report(result, verb);
      return result;
    },

    bulkArchive: async (rowIds, isArchived) => {
      const board = currentBoard();
      if (!board || rowIds.length === 0) return null;

      const result = await write(
        () => boardService.bulkArchive({ boardId: board.id, rowIds, isArchived }),
        () => {},
      );
      if (!result) return null;

      set((state) => ({ rowsById: reconcileRows(state.rowsById, result.rows) }));
      report(result, isArchived ? "Archived" : "Restored");
      return result;
    },

    bulkDelete: async (rowIds) => {
      const board = currentBoard();
      if (!board || rowIds.length === 0) return null;

      const result = await write(
        () => boardService.bulkDelete({ boardId: board.id, rowIds }),
        () => {},
      );
      if (!result) return null;

      set((state) => removeRows(state, result.applied));
      report(result, "Deleted");
      return result;
    },

    bulkMove: async (rowIds, targetNodeId, targetName) => {
      const board = currentBoard();
      if (!board || rowIds.length === 0) return null;

      const result = await write(
        () => boardService.bulkMove({ boardId: board.id, rowIds, targetNodeId }),
        () => {},
      );
      if (!result) return null;

      set((state) => removeRows(state, result.applied));

      const dropped =
        result.droppedColumns.length > 0
          ? ` · ${result.droppedColumns.length} column${result.droppedColumns.length === 1 ? "" : "s"} had no match on ${targetName}`
          : "";

      feedback(
        `${describeBulkResult(result, "Moved")} to ${targetName}${dropped}`,
        bulkTone(result),
      );
      return result;
    },

    importRows: async (input) => {
      const board = currentBoard();
      if (!board) return null;

      const outcome = await write(
        () => boardService.importRows({ ...input, boardId: board.id }),
        () => {},
      );
      if (!outcome) return null;

      await get().reload();

      return outcome;
    },

    addColumn: async (type, name, atIndex, config) => {
      const board = currentBoard();
      if (!board) return null;

      const column = await write(
        () => boardService.createColumn(board.id, type, name, atIndex, config),
        () => {},
      );
      if (!column) return null;

      set((state) =>
        state.board
          ? {
              board: {
                ...state.board,
                columns:
                  atIndex === undefined
                    ? [...state.board.columns, column]
                    : insertColumnAt(state.board.columns, column, atIndex),
              },
            }
          : state,
      );

      return column;
    },

    duplicateColumn: async (columnId) => {
      const board = currentBoard();
      if (!board) return null;

      const result = await write(
        () => boardService.duplicateColumn(board.id, columnId),
        () => {},
      );
      if (!result) return null;

      set((state) => ({
        board: state.board
          ? {
              ...state.board,
              columns: insertColumnAt(
                state.board.columns,
                result.column,
                result.column.position,
              ),
            }
          : state.board,
        rowsById: reconcileRows(state.rowsById, result.rows),
      }));

      return result.column;
    },

    renameColumn: async (columnId, name) => {
      const board = currentBoard();
      if (!board) return false;

      const trimmed = name.trim();
      if (trimmed.length === 0) return false;

      const current = board.columns.find((column) => column.id === columnId);
      if (!current || current.name === trimmed) return false;

      const clash = findColumnByName(board.columns, trimmed, columnId);
      if (clash) {
        useWorkspaceStore
          .getState()
          .pushFeedback(`This board already has a column called “${clash.name}”`, "error");
        return false;
      }

      await get().updateColumnConfig(columnId, { name: trimmed });
      return true;
    },

    updateColumnConfig: async (columnId, patch) => {
      const board = currentBoard();
      if (!board) return;

      const previous = board.columns;
      set((state) =>
        state.board
          ? {
              board: {
                ...state.board,
                columns: state.board.columns.map((column) =>
                  column.id === columnId
                    ? ({
                        ...column,
                        ...(patch.name === undefined ? {} : { name: patch.name }),
                        ...(patch.config ? { config: { ...column.config, ...patch.config } } : {}),
                      } as BoardColumn)
                    : column,
                ),
              },
            }
          : state,
      );

      await write(
        () => boardService.updateColumn(board.id, columnId, patch),
        () =>
          set((state) => (state.board ? { board: { ...state.board, columns: previous } } : state)),
      );
    },

    convertColumn: async (columnId, type) => {
      const board = currentBoard();
      if (!board) return 0;

      const result = await write(
        () => boardService.convertColumn(board.id, columnId, type),
        () => {},
      );
      if (!result) return 0;

      set((state) => ({
        board: state.board
          ? {
              ...state.board,
              columns: state.board.columns.map((column) =>
                column.id === columnId ? result.column : column,
              ),
            }
          : state.board,
        rowsById: reconcileRows(state.rowsById, result.rows),
      }));

      return result.preserved;
    },

    deleteColumn: async (columnId) => {
      const board = currentBoard();
      if (!board) return;

      const columns = await write(
        () => boardService.deleteColumn(board.id, columnId),
        () => {},
      );
      if (!columns) return;

      set((state) => ({
        board: state.board
          ? {
              ...state.board,
              columns,
              views: state.board.views.map((view) => pruneView(view, columns)),
            }
          : state.board,
      }));
    },

    createOption: async (columnId, label) => {
      const board = currentBoard();
      if (!board) return null;

      const column = board.columns.find((candidate) => candidate.id === columnId);
      if (!column || column.type !== "select") return null;

      const color = (["blue", "green", "amber", "red", "violet", "cyan", "pink", "gray"] as const)[
        column.config.options.length % 8
      ];

      const option = await write(
        () => boardService.createSelectOption(board.id, columnId, label, color ?? "gray"),
        () => {},
      );
      if (!option) return null;

      set((state) => ({
        board: state.board
          ? {
              ...state.board,
              columns: state.board.columns.map((candidate) =>
                candidate.id === columnId && candidate.type === "select"
                  ? {
                      ...candidate,
                      config: {
                        ...candidate.config,
                        options: [...candidate.config.options, option],
                      },
                    }
                  : candidate,
              ),
            }
          : state.board,
      }));

      return option;
    },

    setSort: async (columnId, direction) => {
      await get().setSorts(direction === null ? [] : [{ columnId, direction }]);
    },

    setSorts: async (sorts) => {
      await patchActiveView({ sorts }, (view) => ({ sorts: view.sorts }));
    },

    setFilters: async (filters) => {
      await patchActiveView({ filters }, (view) => ({ filters: view.filters }));
    },

    setFilterConjunction: async (filterConjunction) => {
      await patchActiveView({ filterConjunction }, (view) => ({
        filterConjunction: view.filterConjunction,
      }));
    },

    setGroupBy: async (groupByColumnId) => {
      await patchActiveView({ groupByColumnId }, (view) => ({
        groupByColumnId: view.groupByColumnId,
      }));
    },

    setHideEmptyGroups: async (hideEmptyGroups) => {
      await patchActiveView({ hideEmptyGroups }, (view) => ({
        hideEmptyGroups: view.hideEmptyGroups,
      }));
    },

    setDateColumn: async (dateColumnId) => {
      await patchActiveView({ dateColumnId }, (view) => ({ dateColumnId: view.dateColumnId }));
    },

    setEndDateColumn: async (endDateColumnId) => {
      await patchActiveView({ endDateColumnId }, (view) => ({
        endDateColumnId: view.endDateColumnId,
      }));
    },

    setViewType: async (type) => {
      await patchActiveView({ type }, (view) => ({ type: view.type }));
    },

    setRowHeight: async (rowHeight) => {
      await patchActiveView({ rowHeight }, (view) => ({ rowHeight: view.rowHeight }));
    },

    setSubtaskDisplay: async (subtaskDisplay) => {
      await patchActiveView({ subtaskDisplay }, (view) => ({
        subtaskDisplay: view.subtaskDisplay,
      }));
    },

    setGanttZoom: async (ganttZoom) => {
      await patchActiveView({ ganttZoom }, (view) => ({ ganttZoom: view.ganttZoom }));
    },

    setShowDependencies: async (showDependencies) => {
      await patchActiveView({ showDependencies }, (view) => ({
        showDependencies: view.showDependencies,
      }));
    },

    createView: async (name, type) => {
      const board = currentBoard();
      if (!board) return null;

      const view = await write(
        () => boardService.createView(board.id, { name, type }),
        () => {},
      );
      if (!view) return null;

      set((state) => ({
        board: state.board ? { ...state.board, views: [...state.board.views, view] } : state.board,
        activeViewId: view.id,
      }));

      return view.id;
    },

    duplicateView: async (viewId) => {
      const board = currentBoard();
      const source = board?.views.find((view) => view.id === viewId);
      if (!board || !source) return null;

      const view = await write(
        () =>
          boardService.createView(board.id, {
            name: `${source.name} copy`,
            type: source.type,
            from: source,
          }),
        () => {},
      );
      if (!view) return null;

      set((state) => ({
        board: state.board ? { ...state.board, views: [...state.board.views, view] } : state.board,
        activeViewId: view.id,
      }));

      return view.id;
    },

    renameView: async (viewId, name) => {
      const board = currentBoard();
      const previous = board?.views.find((view) => view.id === viewId)?.name;
      if (!board || previous === undefined) return;

      patchView(viewId, { name });

      await write(
        () => boardService.updateView(board.id, viewId, { name }),
        () => patchView(viewId, { name: previous }),
      );
    },

    moveViewTo: async (viewId, toIndex) => {
      const board = currentBoard();
      if (!board) return;

      const before = board.views;
      const views = reorderViews(before, viewId, toIndex);
      if (views === before) return;

      const from = before.findIndex((view) => view.id === viewId);
      set((state) => ({ board: state.board ? { ...state.board, views } : state.board }));

      await write(
        () => boardService.reorderView(board.id, views.map((view) => view.id)),
        () =>
          set((state) => ({
            board: state.board
              ? { ...state.board, views: reorderViews(state.board.views, viewId, from) }
              : state.board,
          })),
      );
    },

    deleteView: async (viewId) => {
      const board = currentBoard();
      if (!board) return;

      const views = await write(
        () => boardService.deleteView(board.id, viewId),
        () => {},
      );
      if (!views) return;

      set((state) => ({
        board: state.board ? { ...state.board, views } : state.board,
        activeViewId:
          state.activeViewId === viewId ? views[0]?.id ?? null : state.activeViewId,
      }));
    },

    resizeColumn: (columnId, width) => {
      const view = activeView();
      if (!view) return;

      patchView(view.id, { columnWidths: { ...view.columnWidths, [columnId]: width } });
    },

    commitColumnWidth: async (columnId, width) => {
      const board = currentBoard();
      const view = activeView();
      if (!board || !view) return;

      const columnWidths = { ...view.columnWidths, [columnId]: width };
      patchView(view.id, { columnWidths });

      await write(
        () => boardService.updateView(board.id, view.id, { columnWidths }),
        () => patchView(view.id, { columnWidths: view.columnWidths }),
      );
    },

    setColumnDisplay: async (columnId, mode) => {
      const board = currentBoard();
      const view = activeView();
      if (!board || !view) return;

      const columnDisplay = { ...(view.columnDisplay ?? {}), [columnId]: mode };
      patchView(view.id, { columnDisplay });

      await write(
        () => boardService.updateView(board.id, view.id, { columnDisplay }),
        () => patchView(view.id, { columnDisplay: view.columnDisplay ?? {} }),
      );
    },

    setColumnHidden: async (columnId, hidden) => {
      const board = currentBoard();
      const view = activeView();
      if (!board || !view) return;

      const hiddenColumnIds = hidden
        ? [...new Set([...view.hiddenColumnIds, columnId])]
        : view.hiddenColumnIds.filter((id) => id !== columnId);

      patchView(view.id, { hiddenColumnIds });

      await write(
        () => boardService.updateView(board.id, view.id, { hiddenColumnIds }),
        () => patchView(view.id, { hiddenColumnIds: view.hiddenColumnIds }),
      );
    },

    moveColumnTo: async (columnId, toIndex) => {
      const board = currentBoard();
      const view = activeView();
      if (!board || !view) return;

      const current =
        view.columnOrder.length > 0
          ? [...view.columnOrder]
          : [...board.columns].sort((a, b) => a.position - b.position).map((column) => column.id);

      const from = current.indexOf(columnId);
      if (from < 0) return;

      const target = Math.min(Math.max(toIndex, 0), current.length - 1);
      const [moved] = current.splice(from, 1);
      if (!moved) return;
      current.splice(target, 0, moved);

      patchView(view.id, { columnOrder: current });

      await write(
        () => boardService.updateView(board.id, view.id, { columnOrder: current }),
        () => patchView(view.id, { columnOrder: view.columnOrder }),
      );
    },
  };
});

export const selectRow = (rowId: string) => (state: BoardStore) => state.rowsById[rowId];

export function selectActiveView(state: BoardStore): SavedView | null {
  const { board, activeViewId } = state;
  return board?.views.find((view) => view.id === activeViewId) ?? board?.views[0] ?? null;
}

export type { CellValue };
