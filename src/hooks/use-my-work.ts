"use client";

import { useCallback, useMemo } from "react";
import { MOCK_NOW } from "@/config/app";
import { useAsyncResource, type AsyncResource } from "@/hooks/use-async-resource";
import { useWorkspaceRole } from "@/hooks/use-permissions";
import { capabilitiesFor } from "@/lib/permissions";
import { collectAllowed } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { myWorkService } from "@/services/my-work-service";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode, MyWorkWidget } from "@/types";

/**
 * My Work (CO-MYW-30).
 *
 * The permission gate is passed *into* the service as a predicate, so a board
 * the user cannot open is never read — filtering results afterwards would mean
 * the client had already seen them.
 */
export function useMyWork(): AsyncResource<readonly MyWorkWidget[]> {
  const role = useWorkspaceRole();
  // The tree is a dependency so creating or trashing a board refreshes the page.
  const tree = useWorkspaceStore(selectTree);

  const allowedIds = useMemo(
    () =>
      new Set(
        collectAllowed(
          tree,
          (node: DriveNode) => !node.isTrashed && capabilitiesFor({ role, user: CURRENT_USER, node }).view,
        ).map((node) => node.id),
      ),
    [tree, role],
  );

  const loader = useCallback(
    (signal: AbortSignal) =>
      myWorkService.load(
        {
          userId: CURRENT_USER.id,
          nowIso: MOCK_NOW,
          allow: (nodeId: string) => allowedIds.has(nodeId),
        },
        signal,
      ),
    [allowedIds],
  );

  return useAsyncResource(loader, { keepPreviousData: true });
}
