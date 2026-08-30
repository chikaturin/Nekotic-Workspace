"use client";

import { useMemo } from "react";
import { archivedCapabilities, archiveSourceOf, inheritedArchiveOf } from "@/lib/archive";
import {
  capabilitiesFor,
  effectiveAccess,
  resolveAccess,
  resolverFor,
  type PermissionContext,
} from "@/lib/permissions";
import { memberRoleOf } from "@/lib/workspace-access";
import { selectPreviewRole, selectRulesFor, usePermissionStore } from "@/store/permission-store";
import { ANONYMOUS_USER, useCurrentUser, useCurrentUserId } from "@/store/session-store";
import { selectActiveWorkspace, selectFullTree, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import {
  roleRank,
  type CapabilitySet,
  type DriveNode,
  type PermissionResolver,
  type ResolvedAccess,
  type WorkspaceRole,
} from "@/types";

function useMemberRole(): WorkspaceRole | null {
  const workspace = useWorkspaceStore(selectActiveWorkspace);

  const userId = useCurrentUserId();

  return useMemo(() => memberRoleOf(workspace, userId), [workspace, userId]);
}

function clamp(real: WorkspaceRole, preview: WorkspaceRole | null): WorkspaceRole {
  if (preview === null) return real;
  return roleRank(preview) < roleRank(real) ? preview : real;
}

export function useWorkspaceRole(): WorkspaceRole {
  const real = useMemberRole();
  const preview = usePermissionStore(selectPreviewRole);

  return clamp(real ?? "viewer", preview);
}

export function useIsWorkspaceMember(): boolean {
  return useMemberRole() !== null;
}

export function useEffectiveRole(node?: DriveNode | null): WorkspaceRole {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));
  const preview = usePermissionStore(selectPreviewRole);
  const nodeId = node?.id ?? null;
  const userId = useCurrentUserId();

  const resolved = useMemo(
    () =>
      effectiveAccess(
        { tree, nodeId, rules, members: workspace.members },
        { kind: "user", userId },
      ).role,
    [tree, nodeId, rules, workspace.members, userId],
  );

  return clamp(resolved, preview);
}

function usePermissionContext(node?: DriveNode | null): PermissionContext {
  const role = useEffectiveRole(node);
  const tree = useWorkspaceStore(selectTree);
  const nodeId = node?.id ?? null;

  const isFrozen = useMemo(() => inheritedArchiveOf(tree, nodeId) !== null, [tree, nodeId]);

  const user = useCurrentUser() ?? ANONYMOUS_USER;

  return useMemo(
    () => ({ role, user, node: node ?? null, isFrozen }),
    [role, user, node, isFrozen],
  );
}

export function usePermissions(node?: DriveNode | null): PermissionResolver {
  const context = usePermissionContext(node);

  return useMemo(() => resolverFor(context), [context]);
}

export function useCapabilities(node?: DriveNode | null): CapabilitySet {
  const context = usePermissionContext(node);

  return useMemo(() => {
    const base = capabilitiesFor(context);
    return context.isFrozen ? archivedCapabilities(base) : base;
  }, [context]);
}

export function useArchiveSource(node?: DriveNode | null): DriveNode | null {
  const tree = useWorkspaceStore(selectTree);
  const nodeId = node?.id ?? null;

  return useMemo(() => archiveSourceOf(tree, nodeId), [tree, nodeId]);
}

export function useAccessList(node: DriveNode | null): readonly ResolvedAccess[] {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));

  return useMemo(
    () => resolveAccess({ tree, nodeId: node?.id ?? null, rules, members: workspace.members }),
    [tree, node, rules, workspace.members],
  );
}
