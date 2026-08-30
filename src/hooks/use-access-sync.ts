"use client";

import { useEffect } from "react";
import { realtime } from "@/lib/realtime/client";
import { currentUserId } from "@/store/session-store";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { useRecentStore } from "@/store/recent-store";
import {
  selectActiveWorkspace,
  selectFullTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { canSeeNode } from "@/lib/permissions/visibility";
import { isWorkspaceMember } from "@/lib/workspace-access";
import { usePermissionStore } from "@/store/permission-store";

export function useAccessSync(): void {
  useEffect(() => {
    const dropIfUnreachable = () => {
      const state = useWorkspaceStore.getState();
      const workspace = selectActiveWorkspace(state);
      const openNodeId = useBoardStore.getState().nodeId;

      const userId = currentUserId();
      const isMember = isWorkspaceMember(workspace, userId);
      const stillAllowed =
        isMember &&
        (openNodeId === null ||
          canSeeNode(
            {
              tree: selectFullTree(state),
              rules: usePermissionStore.getState().rulesByWorkspace[workspace.id] ?? {},
              members: workspace.members,
              isMember,
            },
            openNodeId,
            { kind: "user", userId },
          ));

      if (stillAllowed) return;

      useBoardStore.getState().clear();
      useGridStore.getState().reset();
      useRecentStore.getState().clear();
    };

    const unsubscribeRules = usePermissionStore.subscribe(dropIfUnreachable);
    const unsubscribeWorkspace = useWorkspaceStore.subscribe(dropIfUnreachable);

    const unsubscribeRealtime = realtime.subscribe((event) => {
      if (event.payload.type !== "permission.changed") return;
      if (!event.payload.userIds.includes(currentUserId())) return;
      dropIfUnreachable();
    });

    return () => {
      unsubscribeRules();
      unsubscribeWorkspace();
      unsubscribeRealtime();
    };
  }, []);
}
