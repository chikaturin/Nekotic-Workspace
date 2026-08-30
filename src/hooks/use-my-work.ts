"use client";

import { useCallback } from "react";
import { useAsyncResource, type AsyncResource } from "@/hooks/use-async-resource";
import { myWorkService } from "@/services/my-work-service";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { MyWorkWidget } from "@/types";

export function useMyWork(): AsyncResource<readonly MyWorkWidget[]> {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const loader = useCallback(
    (signal: AbortSignal) => myWorkService.load({ workspaceId, signal }),
    [workspaceId],
  );

  return useAsyncResource(loader, { keepPreviousData: true });
}
