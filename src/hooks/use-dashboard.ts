"use client";

import { useCallback } from "react";
import { useAsyncResource, type AsyncResource } from "@/hooks/use-async-resource";
import { dashboardService } from "@/services/dashboard-service";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DashboardSummary } from "@/types";

export function useDashboard(): AsyncResource<DashboardSummary> {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const loader = useCallback(
    (signal: AbortSignal) => dashboardService.load(workspaceId, signal),
    [workspaceId],
  );

  return useAsyncResource(loader, { keepPreviousData: true });
}
