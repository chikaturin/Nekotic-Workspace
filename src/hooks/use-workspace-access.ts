"use client";

import { useMemo } from "react";
import {
  canSeeNode,
  restrictedNodesOf,
  visibleTree,
  type VisibilityInput,
} from "@/lib/permissions/visibility";
import {
  isWorkspaceMember,
  visibleWorkspaces,
  workspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace-access";
import { selectRulesFor, usePermissionStore } from "@/store/permission-store";
import { useCurrentUserId } from "@/store/session-store";
import {
  selectActiveWorkspace,
  selectFullTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import type { AccessSubject, DriveNode, Workspace } from "@/types";

function useMe(): AccessSubject {
  const userId = useCurrentUserId();

  return useMemo(() => ({ kind: "user", userId }), [userId]);
}

export function useMyWorkspaces(): readonly Workspace[] {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const userId = useCurrentUserId();

  return useMemo(() => visibleWorkspaces(workspaces, userId), [workspaces, userId]);
}

export function useWorkspaceAccess(): WorkspaceAccess {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const userId = useCurrentUserId();

  return useMemo(
    () => workspaceAccess(workspaces, activeId, userId),
    [workspaces, activeId, userId],
  );
}

function useVisibilityInput(): VisibilityInput {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));
  const userId = useCurrentUserId();

  return useMemo(
    () => ({
      tree,
      rules,
      members: workspace.members,
      isMember: isWorkspaceMember(workspace, userId),
    }),
    [tree, rules, workspace, userId],
  );
}

export function useVisibleTree(): readonly DriveNode[] {
  const input = useVisibilityInput();
  const me = useMe();

  return useMemo(() => visibleTree(input, me), [input, me]);
}

export function useNodeVisibility(nodeId: string | null): boolean {
  const input = useVisibilityInput();
  const me = useMe();

  return useMemo(() => canSeeNode(input, nodeId, me), [input, nodeId, me]);
}

export function useRestrictedNodes(): readonly DriveNode[] {
  const tree = useWorkspaceStore(selectFullTree);

  return useMemo(() => restrictedNodesOf(tree), [tree]);
}
