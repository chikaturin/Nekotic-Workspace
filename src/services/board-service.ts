import { boardApi } from "@/services/api/board.api";
import { boardRowsApi } from "@/services/api/board-rows.api";
import { boardViewsApi } from "@/services/api/board-views.api";
import { useWorkspaceStore } from "@/store/workspace-store";
export type * from "@/services/board-types";

import type {
  Backlink,
  BoardDescriptor,
  BulkArchiveInput,
  BulkMoveInput,
  BulkTargets,
  BulkUpdateInput,
  ConvertColumnResult,
  CreateRowInput,
  CreateViewInput,
  ImportRowsInput,
  ImportRowsResult,
  RelationTarget,
  UpdateCellsInput,
  UpdateCellsResult,
} from "@/services/board-types";
import type {
  ActivityEntry,
  BoardColumn,
  BoardRow,
  BoardSnapshot,
  BulkMoveResult,
  ColumnPatch,
  ColumnType,
  SavedView,
  SelectOption,
} from "@/types";

const workspaceId = (): string =>
  useWorkspaceStore.getState().activeWorkspaceId;

export const boardService = {
  getBoard: (nodeId: string, signal?: AbortSignal): Promise<BoardSnapshot> =>
    boardApi.byNode(nodeId, signal),

  searchRows: async (
    boardId: string,
    query: string,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<readonly BoardRow[]> => {
    const trimmed = query.trim();

    if (trimmed === "") {
      const page = await boardRowsApi.list(boardId, { limit }, signal);

      return page.items;
    }

    return boardRowsApi.search(boardId, trimmed, signal);
  },

  createRow: ({
    boardId,
    cells,
    afterRowId,
    parentRowId,
  }: CreateRowInput): Promise<BoardRow> =>
    boardRowsApi.create(boardId, {
      cells: cells ?? {},
      ...(afterRowId == null ? {} : { afterRowId }),
      ...(parentRowId == null ? {} : { parentRowId }),
    }),

  duplicateRow: (boardId: string, rowId: string): Promise<BoardRow> =>
    boardRowsApi.duplicate(boardId, rowId),

  deleteRow: (boardId: string, rowId: string): Promise<void> =>
    boardRowsApi.remove(boardId, rowId),

  setRowParent: (
    boardId: string,
    rowId: string,
    parentRowId: string | null,
  ): Promise<BoardRow> => boardRowsApi.setParent(boardId, rowId, parentRowId),

  listSubtasks: (
    boardId: string,
    rowId: string,
    signal?: AbortSignal,
  ): Promise<readonly BoardRow[]> =>
    boardRowsApi.subtasks(boardId, rowId, signal),

  updateCells: ({
    boardId,
    edits,
    baseRevisions,
  }: UpdateCellsInput): Promise<UpdateCellsResult> =>
    boardRowsApi.updateCells(boardId, edits, baseRevisions),

  bulkUpdate: ({ boardId, rowIds, values }: BulkUpdateInput) =>
    boardRowsApi.bulkUpdate(boardId, rowIds, values),

  bulkArchive: ({ boardId, rowIds, isArchived }: BulkArchiveInput) =>
    boardRowsApi.bulkArchive(boardId, rowIds, isArchived),

  bulkDelete: ({ boardId, rowIds }: BulkTargets) =>
    boardRowsApi.bulkDelete(boardId, rowIds),

  bulkMove: async ({
    boardId,
    rowIds,
    targetNodeId,
  }: BulkMoveInput): Promise<BulkMoveResult> => {
    const target = await boardApi.byNode(targetNodeId);

    return boardRowsApi.bulkMove(boardId, rowIds, target.board.id);
  },

  importRows: async (input: ImportRowsInput): Promise<ImportRowsResult> => {
    const form = new FormData();

    form.append("file", input.file, input.file.name);
    form.append(
      "request",
      JSON.stringify({
        mappings: input.mappings,
        invalidPolicy: input.invalidPolicy,
        ...(input.removeColumnIds === undefined
          ? {}
          : { removeColumnIds: input.removeColumnIds }),
        ...(input.hasHeaderRow === undefined
          ? {}
          : { hasHeaderRow: input.hasHeaderRow }),
      }),
    );

    return boardApi.importRows(input.boardId, form);
  },

  createColumn: (
    boardId: string,
    type: ColumnType,
    name: string,
    atIndex?: number,
    config?: BoardColumn["config"],
  ): Promise<BoardColumn> =>
    boardApi.addColumn(boardId, {
      type,
      name,
      ...(atIndex === undefined ? {} : { atIndex }),
      ...(config === undefined ? {} : { config }),
    }),

  duplicateColumn: async (
    boardId: string,
    columnId: string,
  ): Promise<{
    readonly column: BoardColumn;
    readonly rows: readonly BoardRow[];
  }> => {
    const column = await boardApi.duplicateColumn(boardId, columnId);

    return { column, rows: (await boardRowsApi.list(boardId, {})).items };
  },

  updateColumn: (
    boardId: string,
    columnId: string,
    patch: ColumnPatch,
  ): Promise<BoardColumn> => boardApi.updateColumn(boardId, columnId, patch),

  listColumns: (
    boardId: string,
    signal?: AbortSignal,
  ): Promise<readonly BoardColumn[]> => boardApi.columns(boardId, signal),

  reorderColumn: (
    boardId: string,
    columnIds: readonly string[],
  ): Promise<readonly BoardColumn[]> =>
    boardApi.reorderColumns(boardId, columnIds),

  deleteColumn: async (
    boardId: string,
    columnId: string,
  ): Promise<readonly BoardColumn[]> => {
    await boardApi.deleteColumn(boardId, columnId);

    return boardApi.columns(boardId);
  },

  convertColumn: async (
    boardId: string,
    columnId: string,
    type: ColumnType,
  ): Promise<ConvertColumnResult> => {
    const result = await boardApi.convertColumn(boardId, columnId, type);
    const page = await boardRowsApi.list(boardId, {});

    return {
      column: result.column,
      rows: page.items,
      preserved: result.affectedRows,
    };
  },

  createSelectOption: async (
    boardId: string,
    columnId: string,
    label: string,
    color: SelectOption["color"],
  ): Promise<SelectOption | null> => {
    const column = await boardApi.addOption(boardId, columnId, {
      label,
      color,
    });

    if (column.type !== "select") return null;

    return column.config.options.at(-1) ?? null;
  },

  listBoards: (signal?: AbortSignal): Promise<readonly BoardDescriptor[]> =>
    boardApi.list(workspaceId(), signal),

  relationIndex: (
    boardId: string,
    rowIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly RelationTarget[]> =>
    rowIds.length === 0
      ? Promise.resolve([])
      : boardApi.relationIndex(boardId, rowIds, signal),

  listBacklinks: (
    boardId: string,
    rowId: string,
    signal?: AbortSignal,
  ): Promise<readonly Backlink[]> =>
    boardRowsApi.backlinks(boardId, rowId, signal),

  listViews: (boardId: string, signal?: AbortSignal) =>
    boardViewsApi.list(boardId, signal),

  createView: (boardId: string, input: CreateViewInput): Promise<SavedView> =>
    boardViewsApi.create(boardId, input),

  updateView: (
    boardId: string,
    viewId: string,
    patch: Partial<SavedView>,
  ): Promise<SavedView> => boardViewsApi.update(boardId, viewId, patch),

  reorderView: (
    boardId: string,
    viewIds: readonly string[],
  ): Promise<readonly SavedView[]> => boardViewsApi.reorder(boardId, viewIds),

  deleteView: async (
    boardId: string,
    viewId: string,
  ): Promise<readonly SavedView[]> => {
    await boardViewsApi.remove(boardId, viewId);

    return boardViewsApi.list(boardId);
  },

  listActivity: async (
    boardId: string,
    rowId: string,
    signal?: AbortSignal,
  ): Promise<readonly ActivityEntry[]> =>
    (await boardRowsApi.activity(boardId, rowId, signal)).items,
};
