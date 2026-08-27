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
import { CURRENT_USER } from "@/mock/users";
import { selectRulesFor, usePermissionStore } from "@/store/permission-store";
import {
  selectActiveWorkspace,
  selectFullTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import type { AccessSubject, DriveNode, Workspace } from "@/types";

/**
 * Resource access, as components ask for it (SY-WSA, SY-FAC).
 *
 * Two questions, in order, and never merged:
 *
 *   1. `useWorkspaceAccess()` — am I in this workspace at all,
 *   2. `useVisibleTree()` / `useNodeVisibility()` — may I see this node.
 *
 * Only then does `usePermissions()` decide what may be done with it. A
 * component that needs to know whether to render something asks one of these;
 * none of them opens `workspace.members` and looks for an id.
 */

const ME: AccessSubject = { kind: "user", userId: CURRENT_USER.id };

/** The workspaces the signed-in user belongs to. Nothing else is listed. */
export function useMyWorkspaces(): readonly Workspace[] {
  const workspaces = useWorkspaceStore((state) => state.workspaces);

  return useMemo(() => visibleWorkspaces(workspaces, CURRENT_USER.id), [workspaces]);
}

/**
 * Whether the workspace in context may be opened.
 *
 * The guard reads this. It answers the same way for a workspace that does not
 * exist and one the person is not in, so a URL cannot be used to enumerate
 * which workspaces are real.
 */
export function useWorkspaceAccess(): WorkspaceAccess {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeId = useWorkspaceStore((state) => state.activeWorkspaceId);

  return useMemo(
    () => workspaceAccess(workspaces, activeId, CURRENT_USER.id),
    [workspaces, activeId],
  );
}

/** Everything the visibility engine needs, subscribed from both stores. */
function useVisibilityInput(): VisibilityInput {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));

  return useMemo(
    () => ({
      tree,
      rules,
      members: workspace.members,
      isMember: isWorkspaceMember(workspace, CURRENT_USER.id),
    }),
    [tree, rules, workspace],
  );
}

/**
 * The tree as the signed-in user is allowed to know it.
 *
 * Subscribed to both the drive and the access rules, so a grant written in the
 * access dialog repaints the sidebar, the drive grid and the breadcrumbs in the
 * same frame — and so does a revocation.
 */
export function useVisibleTree(): readonly DriveNode[] {
  const input = useVisibilityInput();

  return useMemo(() => visibleTree(input, ME), [input]);
}

/**
 * Whether one node is visible, checked against the *unfiltered* tree.
 *
 * The distinction matters on a direct URL: a node missing from the pruned tree
 * is either refused or not there at all, and the two want different screens.
 */
export function useNodeVisibility(nodeId: string | null): boolean {
  const input = useVisibilityInput();

  return useMemo(() => canSeeNode(input, nodeId, ME), [input, nodeId]);
}

/**
 * Every restricted folder in the workspace, visible or not.
 *
 * The admin recovery list. Gated on `workspace.permission.manage` by the
 * surface that renders it — an admin can grant themselves any folder, so
 * withholding the names would only produce folders nobody can reopen.
 */
export function useRestrictedNodes(): readonly DriveNode[] {
  const tree = useWorkspaceStore(selectFullTree);

  return useMemo(() => restrictedNodesOf(tree), [tree]);
}
