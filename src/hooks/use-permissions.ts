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
import { CURRENT_USER } from "@/mock/users";
import { selectPreviewRole, selectRulesFor, usePermissionStore } from "@/store/permission-store";
import { selectActiveWorkspace, selectFullTree, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import {
  roleRank,
  type CapabilitySet,
  type DriveNode,
  type PermissionResolver,
  type ResolvedAccess,
  type WorkspaceRole,
} from "@/types";

/**
 * The one way a component asks about permission (SY-RBC-42).
 *
 * `usePermissions(node)` hands back `can("board.column.create")`. No component
 * reads a role, and none re-derives a rule: everything lands in the catalogue,
 * which is what makes the matrix on screen the same matrix the app runs on.
 *
 * None of it is enforcement. Hiding a button is a courtesy to the user; the
 * backend still has to refuse the call.
 */

/**
 * Role the signed-in user holds on the workspace, before any node rules.
 *
 * Null when they hold none. That distinction is the point: the old fallback to
 * `viewer` quietly turned "not a member of this workspace" into "a member with
 * the lowest role", which is read access to a tenant somebody was never in.
 */
function useMemberRole(): WorkspaceRole | null {
  const workspace = useWorkspaceStore(selectActiveWorkspace);

  return useMemo(() => memberRoleOf(workspace, CURRENT_USER.id), [workspace]);
}

/**
 * Previewing narrows, never widens. A member previewing as admin still sees a
 * member's app — otherwise the preview would be a privilege escalation with a
 * dropdown in front of it.
 */
function clamp(real: WorkspaceRole, preview: WorkspaceRole | null): WorkspaceRole {
  if (preview === null) return real;
  return roleRank(preview) < roleRank(real) ? preview : real;
}

/**
 * Role held on the workspace as a whole, with any preview applied.
 *
 * A non-member is reported as `viewer` *for rendering purposes only* — every
 * surface above them is already blocked by the workspace guard, and their tree
 * is empty. Nothing here grants access; `useIsWorkspaceMember` is the question
 * to ask when membership itself is what matters.
 */
export function useWorkspaceRole(): WorkspaceRole {
  const real = useMemberRole();
  const preview = usePermissionStore(selectPreviewRole);

  return clamp(real ?? "viewer", preview);
}

/** Membership itself, for the surfaces that gate on being in at all. */
export function useIsWorkspaceMember(): boolean {
  return useMemberRole() !== null;
}

/**
 * Role held on one node, resolved through the inheritance chain (SY-INH-43).
 * A node with no rule of its own holds whatever its nearest ancestor says.
 */
export function useEffectiveRole(node?: DriveNode | null): WorkspaceRole {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));
  const preview = usePermissionStore(selectPreviewRole);
  const nodeId = node?.id ?? null;

  const resolved = useMemo(
    () =>
      effectiveAccess(
        { tree, nodeId, rules, members: workspace.members },
        { kind: "user", userId: CURRENT_USER.id },
      ).role,
    [tree, nodeId, rules, workspace.members],
  );

  return clamp(resolved, preview);
}

/** The context every check on this node runs against. */
function usePermissionContext(node?: DriveNode | null): PermissionContext {
  const role = useEffectiveRole(node);
  const tree = useWorkspaceStore(selectTree);
  const nodeId = node?.id ?? null;

  // An archived *ancestor* freezes this node, because the freeze cannot be
  // lifted from inside it. A node archived in its own right keeps its write
  // permissions so its surface can still offer Restore.
  const isFrozen = useMemo(() => inheritedArchiveOf(tree, nodeId) !== null, [tree, nodeId]);

  return useMemo(
    () => ({ role, user: CURRENT_USER, node: node ?? null, isFrozen }),
    [role, node, isFrozen],
  );
}

/** `can("row.update")` — bound to one node, or to the workspace when omitted. */
export function usePermissions(node?: DriveNode | null): PermissionResolver {
  const context = usePermissionContext(node);

  return useMemo(() => resolverFor(context), [context]);
}

/**
 * The coarse flags older surfaces branch on, derived from the same catalogue.
 * New code should ask `usePermissions` for the key it actually means.
 */
export function useCapabilities(node?: DriveNode | null): CapabilitySet {
  const context = usePermissionContext(node);

  return useMemo(() => {
    const base = capabilitiesFor(context);
    return context.isFrozen ? archivedCapabilities(base) : base;
  }, [context]);
}

/** The archived node freezing this one — itself, or the ancestor that holds it. */
export function useArchiveSource(node?: DriveNode | null): DriveNode | null {
  const tree = useWorkspaceStore(selectTree);
  const nodeId = node?.id ?? null;

  return useMemo(() => archiveSourceOf(tree, nodeId), [tree, nodeId]);
}

/** Everyone with access to a node, each labelled inherited, explicit or override. */
export function useAccessList(node: DriveNode | null): readonly ResolvedAccess[] {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));

  return useMemo(
    () => resolveAccess({ tree, nodeId: node?.id ?? null, rules, members: workspace.members }),
    [tree, node, rules, workspace.members],
  );
}
