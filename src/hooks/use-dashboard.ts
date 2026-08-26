"use client";

import { useCallback, useMemo } from "react";
import { MOCK_NOW } from "@/config/app";
import { useAsyncResource, type AsyncResource } from "@/hooks/use-async-resource";
import { useWorkspaceRole } from "@/hooks/use-permissions";
import { capabilitiesFor } from "@/lib/permissions";
import { collectAllowed } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { dashboardService } from "@/services/dashboard-service";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DashboardSummary, DriveNode } from "@/types";

/**
 * Dashboard (SY-DSH-44).
 *
 * The permission gate is passed into the service as a predicate, the same way
 * My Work does it: a board the user cannot open is never read, so it cannot be
 * counted and then filtered out of a number they already saw.
 */
export function useDashboard(): AsyncResource<DashboardSummary> {
  const role = useWorkspaceRole();
  // The tree is a dependency so creating or trashing a board refreshes here.
  const tree = useWorkspaceStore(selectTree);

  const allowedIds = useMemo(
    () =>
      new Set(
        collectAllowed(
          tree,
          (node: DriveNode) =>
            !node.isTrashed && capabilitiesFor({ role, user: CURRENT_USER, node }).view,
        ).map((node) => node.id),
      ),
    [tree, role],
  );

  const loader = useCallback(
    (signal: AbortSignal) =>
      dashboardService.load(
        { nowIso: MOCK_NOW, allow: (nodeId: string) => allowedIds.has(nodeId) },
        signal,
      ),
    [allowedIds],
  );

  return useAsyncResource(loader, { keepPreviousData: true });
}
