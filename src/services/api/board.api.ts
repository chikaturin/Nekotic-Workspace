import { apiFetch, apiSend } from "@/services/http/client";
import type { BoardDescriptor, RelationTarget } from "@/services/board-types";
import type {
  Board,
  BoardColumn,
  BoardRow,
  BoardSnapshot,
  BoardTemplate,
  CellValue,
  SavedView,
} from "@/types";

export const boardApi = {
  byNode: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<BoardSnapshot>(`/nodes/${nodeId}/board`, { signal }),

  get: (boardId: string, signal?: AbortSignal) =>
    apiFetch<Board>(`/boards/${boardId}`, { signal }),

  list: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly BoardDescriptor[]>(`/workspaces/${workspaceId}/boards`, {
      signal,
    }),

  update: (boardId: string, patch: Readonly<Record<string, unknown>>) =>
    apiFetch<Board>(`/boards/${boardId}`, { method: "PATCH", body: patch }),

  columns: (boardId: string, signal?: AbortSignal) =>
    apiFetch<readonly BoardColumn[]>(`/boards/${boardId}/columns`, { signal }),

  addColumn: (boardId: string, column: Readonly<Record<string, unknown>>) =>
    apiFetch<BoardColumn>(`/boards/${boardId}/columns`, {
      method: "POST",
      body: column,
    }),

  updateColumn: (
    boardId: string,
    columnId: string,
    patch: object,
  ) =>
    apiFetch<BoardColumn>(`/boards/${boardId}/columns/${columnId}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteColumn: (boardId: string, columnId: string) =>
    apiSend(`/boards/${boardId}/columns/${columnId}`, { method: "DELETE" }),

  duplicateColumn: (boardId: string, columnId: string) =>
    apiFetch<BoardColumn>(`/boards/${boardId}/columns/${columnId}/duplicate`, {
      method: "POST",
    }),

  convertColumn: (boardId: string, columnId: string, type: string) =>
    apiFetch<{ readonly column: BoardColumn; readonly affectedRows: number }>(
      `/boards/${boardId}/columns/${columnId}/convert`,
      { method: "POST", body: { type } },
    ),

  reorderColumns: (boardId: string, columnIds: readonly string[]) =>
    apiFetch<readonly BoardColumn[]>(`/boards/${boardId}/columns/reorder`, {
      method: "POST",
      body: { columnIds },
    }),

  addOption: (
    boardId: string,
    columnId: string,
    option: Readonly<Record<string, unknown>>,
  ) =>
    apiFetch<BoardColumn>(`/boards/${boardId}/columns/${columnId}/options`, {
      method: "POST",
      body: option,
    }),

  updateOption: (
    boardId: string,
    columnId: string,
    optionId: string,
    patch: Readonly<Record<string, unknown>>,
  ) =>
    apiFetch<BoardColumn>(
      `/boards/${boardId}/columns/${columnId}/options/${optionId}`,
      { method: "PATCH", body: patch },
    ),

  deleteOption: (boardId: string, columnId: string, optionId: string) =>
    apiSend(`/boards/${boardId}/columns/${columnId}/options/${optionId}`, {
      method: "DELETE",
    }),

  templates: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly BoardTemplate[]>(
      `/workspaces/${workspaceId}/board-templates`,
      { signal },
    ),

  template: (templateId: string, signal?: AbortSignal) =>
    apiFetch<BoardTemplate>(`/board-templates/${templateId}`, { signal }),

  saveTemplate: (workspaceId: string, body: Readonly<Record<string, unknown>>) =>
    apiFetch<BoardTemplate>(`/workspaces/${workspaceId}/board-templates`, {
      method: "POST",
      body,
    }),

  deleteTemplate: (templateId: string) =>
    apiSend(`/board-templates/${templateId}`, { method: "DELETE" }),

  relationIndex: (
    boardId: string,
    rowIds: readonly string[],
    signal?: AbortSignal,
  ) =>
    apiFetch<readonly RelationTarget[]>(`/boards/${boardId}/relation-index`, {
      query: { ids: rowIds.join(",") },
      signal,
    }),

  importRows: (boardId: string, body: FormData) =>
    apiFetch<{
      readonly created: number;
      readonly skipped: number;
      readonly issueCount: number;
      readonly rowIds: readonly string[];
      readonly removedColumns?: readonly string[];
    }>(`/boards/${boardId}/import`, { method: "POST", body }),

  exportRows: (boardId: string, body: Readonly<Record<string, unknown>>) =>
    apiFetch<{ readonly url: string }>(`/boards/${boardId}/export`, {
      method: "POST",
      body,
    }),
};

export type { BoardRow, CellValue, SavedView };
