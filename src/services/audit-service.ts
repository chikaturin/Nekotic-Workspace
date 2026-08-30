import { governanceApi } from "@/services/api/governance.api";
import type { AuditPage, AuditQuery } from "@/types";

export const auditService = {
  list: (
    workspaceId: string,
    query: AuditQuery = {},
    signal?: AbortSignal,
  ): Promise<AuditPage> => governanceApi.page(workspaceId, query, signal),

  exportCsv: (
    workspaceId: string,
    query: AuditQuery = {},
    signal?: AbortSignal,
  ): Promise<Blob> => governanceApi.exportCsv(workspaceId, query, signal),
};
