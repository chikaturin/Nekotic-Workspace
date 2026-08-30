import { API_BASE_URL } from "@/config/api";
import { apiFetch } from "@/services/http/client";
import { getAccessToken } from "@/services/http/access-token";
import type { AuditPage, AuditQuery } from "@/types";

export const governanceApi = {
  page: (workspaceId: string, query: AuditQuery, signal?: AbortSignal) =>
    apiFetch<AuditPage>(`/workspaces/${workspaceId}/audit`, {
      query: {
        module: query.module,
        severity: query.severity,
        actorId: query.actorId,
        search: query.search,
        limit: query.limit,
      },
      signal,
    }),

  exportCsv: async (
    workspaceId: string,
    query: AuditQuery,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }

    const token = getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}/workspaces/${workspaceId}/audit/export?${params.toString()}`,
      {
        credentials: "include",
        headers: token === null ? {} : { Authorization: `Bearer ${token}` },
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Audit export failed with ${String(response.status)}`);
    }

    return response.blob();
  },
};
