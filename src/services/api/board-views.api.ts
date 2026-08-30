import { apiFetch, apiSend } from "@/services/http/client";
import type { SavedView } from "@/types";

export const boardViewsApi = {
  list: (boardId: string, signal?: AbortSignal) =>
    apiFetch<readonly SavedView[]>(`/boards/${boardId}/views`, { signal }),

  create: (boardId: string, view: object) =>
    apiFetch<SavedView>(`/boards/${boardId}/views`, {
      method: "POST",
      body: view,
    }),

  update: (
    boardId: string,
    viewId: string,
    patch: object,
  ) =>
    apiFetch<SavedView>(`/boards/${boardId}/views/${viewId}`, {
      method: "PATCH",
      body: patch,
    }),

  remove: (boardId: string, viewId: string) =>
    apiSend(`/boards/${boardId}/views/${viewId}`, { method: "DELETE" }),

  reorder: (boardId: string, viewIds: readonly string[]) =>
    apiFetch<readonly SavedView[]>(`/boards/${boardId}/views/reorder`, {
      method: "POST",
      body: { viewIds },
    }),

  savePreferences: (
    boardId: string,
    viewId: string,
    preferences: Readonly<Record<string, unknown>>,
  ) =>
    apiSend(`/boards/${boardId}/views/${viewId}/preferences`, {
      method: "PUT",
      body: preferences,
    }),
};
