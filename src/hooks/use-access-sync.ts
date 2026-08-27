"use client";

import { useEffect } from "react";
import { realtime } from "@/lib/realtime/client";
import { boardService } from "@/services/board-service";
import { CURRENT_USER } from "@/mock/users";
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

/**
 * Losing access while you are standing in it (SY-CIV).
 *
 * Two things have to happen, and they are not the same thing:
 *
 *   1. **stop showing it** — the tree the surfaces read is derived, so a rule
 *      change repaints them on the next frame with no work here at all,
 *   2. **drop what was already loaded** — a board's records, the open drawer,
 *      the row cache. Those are copies, and a copy does not re-derive itself.
 *
 * The second is what this does. Without it the drive is empty, the sidebar is
 * empty, and a board full of somebody's data is still sitting on screen until
 * the page is reloaded.
 *
 * It runs off the store rather than off a socket, because the store is what
 * changes either way — a local revocation and a `permission.changed` frame from
 * another tab both land in the same place, so there is one code path instead of
 * two that can disagree.
 */
export function useAccessSync(): void {
  useEffect(() => {
    /** Drop everything scoped to a node this person may no longer open. */
    const dropIfUnreachable = () => {
      const state = useWorkspaceStore.getState();
      const workspace = selectActiveWorkspace(state);
      const openNodeId = useBoardStore.getState().nodeId;

      const isMember = isWorkspaceMember(workspace, CURRENT_USER.id);
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
            { kind: "user", userId: CURRENT_USER.id },
          ));

      if (stillAllowed) return;

      // Cached records are the sensitive part: the tree can be re-derived, a
      // loaded board cannot un-load itself.
      boardService.reset();
      useBoardStore.getState().clear();
      useGridStore.getState().reset();
      useRecentStore.getState().clear();
    };

    const unsubscribeRules = usePermissionStore.subscribe(dropIfUnreachable);
    const unsubscribeWorkspace = useWorkspaceStore.subscribe(dropIfUnreachable);

    /**
     * A revocation from elsewhere. The frame carries no resource content — the
     * announcement of a revocation must not be the thing that leaks what was
     * revoked — so it is treated purely as a signal to re-check.
     */
    const unsubscribeRealtime = realtime.subscribe((event) => {
      if (event.payload.type !== "permission.changed") return;
      if (!event.payload.userIds.includes(CURRENT_USER.id)) return;
      dropIfUnreachable();
    });

    return () => {
      unsubscribeRules();
      unsubscribeWorkspace();
      unsubscribeRealtime();
    };
  }, []);
}
