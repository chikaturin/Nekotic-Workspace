import { insightsApi } from "@/services/api/insights.api";
import type { DashboardSummary } from "@/types";

export const dashboardService = {
  load: (workspaceId: string, signal?: AbortSignal): Promise<DashboardSummary> =>
    insightsApi.dashboard(workspaceId, signal),
};
