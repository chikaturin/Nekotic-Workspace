import { apiFetch, apiSend } from "@/services/http/client";
import type { Backlink } from "@/services/board-types";
import type {
  ActivityEntry,
  BoardRow,
  BulkMoveResult,
  BulkResult,
  CellEdit,
  CellValue,
  ConflictNotice,
} from "@/types";

export interface ActivityPage {
  readonly items: readonly ActivityEntry[];
  readonly nextCursor: string | null;
}

export interface RowPage {
  readonly items: readonly BoardRow[];
  readonly nextCursor: string | null;
}

export const boardRowsApi = {
  list: (
    boardId: string,
    query: Readonly<Record<string, string | number | undefined>> = {},
    signal?: AbortSignal,
  ) => apiFetch<RowPage>(`/boards/${boardId}/rows`, { query, signal }),

  get: (boardId: string, rowId: string, signal?: AbortSignal) =>
    apiFetch<BoardRow>(`/boards/${boardId}/rows/${rowId}`, { signal }),

  search: (boardId: string, query: string, signal?: AbortSignal) =>
    apiFetch<readonly BoardRow[]>(`/boards/${boardId}/rows/search`, {
      query: { q: query },
      signal,
    }),

  create: (
    boardId: string,
    body: {
      readonly cells?: Readonly<Record<string, CellValue>>;
      readonly afterRowId?: string | null;
      readonly parentRowId?: string | null;
    },
  ) => apiFetch<BoardRow>(`/boards/${boardId}/rows`, { method: "POST", body }),

  updateCells: (
    boardId: string,
    edits: readonly CellEdit[],
    baseRevisions?: Readonly<Record<string, number>>,
  ) =>
    apiFetch<{
      readonly rows: readonly BoardRow[];
      readonly conflicts: readonly ConflictNotice[];
    }>(`/boards/${boardId}/rows/cells`, {
      method: "PATCH",
      body: {
        edits,
        ...(baseRevisions === undefined ? {} : { baseRevisions }),
      },
    }),

  duplicate: (boardId: string, rowId: string) =>
    apiFetch<BoardRow>(`/boards/${boardId}/rows/${rowId}/duplicate`, {
      method: "POST",
    }),

  remove: (boardId: string, rowId: string) =>
    apiSend(`/boards/${boardId}/rows/${rowId}`, { method: "DELETE" }),

  setParent: (boardId: string, rowId: string, parentRowId: string | null) =>
    apiFetch<BoardRow>(`/boards/${boardId}/rows/${rowId}/parent`, {
      method: "PUT",
      body: { parentRowId },
    }),

  setPosition: (boardId: string, rowId: string, position: number) =>
    apiFetch<BoardRow>(`/boards/${boardId}/rows/${rowId}/position`, {
      method: "PATCH",
      body: { position },
    }),

  subtasks: (boardId: string, rowId: string, signal?: AbortSignal) =>
    apiFetch<readonly BoardRow[]>(`/boards/${boardId}/rows/${rowId}/subtasks`, {
      signal,
    }),

  activity: (boardId: string, rowId: string, signal?: AbortSignal) =>
    apiFetch<ActivityPage>(`/boards/${boardId}/rows/${rowId}/activity`, {
      signal,
    }),

  backlinks: (boardId: string, rowId: string, signal?: AbortSignal) =>
    apiFetch<readonly Backlink[]>(
      `/boards/${boardId}/rows/${rowId}/backlinks`,
      { signal },
    ),

  bulkUpdate: (
    boardId: string,
    rowIds: readonly string[],
    cells: Readonly<Record<string, CellValue>>,
  ) =>
    apiFetch<BulkResult>(`/boards/${boardId}/rows/bulk/update`, {
      method: "POST",
      body: { rowIds, cells },
    }),

  bulkArchive: (
    boardId: string,
    rowIds: readonly string[],
    isArchived: boolean,
  ) =>
    apiFetch<BulkResult>(`/boards/${boardId}/rows/bulk/archive`, {
      method: "POST",
      body: { rowIds, isArchived },
    }),

  bulkDelete: (boardId: string, rowIds: readonly string[]) =>
    apiFetch<BulkResult>(`/boards/${boardId}/rows/bulk/delete`, {
      method: "POST",
      body: { rowIds },
    }),

  bulkMove: (
    boardId: string,
    rowIds: readonly string[],
    targetBoardId: string,
  ) =>
    apiFetch<BulkMoveResult>(`/boards/${boardId}/rows/bulk/move`, {
      method: "POST",
      body: { rowIds, targetBoardId },
    }),
};
