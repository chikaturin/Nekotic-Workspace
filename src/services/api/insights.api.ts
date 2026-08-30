import { apiFetch } from "@/services/http/client";
import type { DashboardSummary, MyWorkWidget, SearchGroup } from "@/types";

export const insightsApi = {
  search: (workspaceId: string, query: string, signal?: AbortSignal) =>
    apiFetch<readonly SearchGroup[]>(`/workspaces/${workspaceId}/search`, {
      query: { q: query },
      signal,
    }),

  dashboard: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<DashboardSummary>(`/workspaces/${workspaceId}/dashboard`, {
      signal,
    }),

  myWork: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly MyWorkWidget[]>("/me/work", {
      query: { workspaceId },
      signal,
    }),
};
