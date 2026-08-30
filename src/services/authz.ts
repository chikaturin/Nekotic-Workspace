import { inheritedArchiveOf } from "@/lib/archive";
import { can, effectiveAccess, requirementFor } from "@/lib/permissions";
import { findNodeById } from "@/lib/tree";
import { permissionDenied } from "@/services/errors";
import { usePermissionStore } from "@/store/permission-store";
import {
  getFullTree,
  selectActiveWorkspace,
  useWorkspaceStore,
} from "@/store/workspace-store";
import type { PermissionKey } from "@/types";
import { currentUser } from "@/store/session-store";

function contextFor(nodeId: string | null) {
  const state = useWorkspaceStore.getState();
  const workspace = selectActiveWorkspace(state);
  const tree = getFullTree();
  const rules = usePermissionStore.getState().rulesByWorkspace[workspace.id] ?? {};

  const { role } = effectiveAccess(
    { tree, nodeId, rules, members: workspace.members },
    { kind: "user", userId: currentUser().id },
  );

  return {
    role,
    user: currentUser(),
    node: nodeId ? findNodeById(tree, nodeId) : null,
    isFrozen: inheritedArchiveOf(tree, nodeId) !== null,
  };
}

export function callerCan(nodeId: string | null, key: PermissionKey): boolean {
  return can(key, contextFor(nodeId));
}

export function requirePermission(
  nodeId: string | null,
  key: PermissionKey,
  action: string,
): void {
  if (callerCan(nodeId, key)) return;
  throw permissionDenied(`You do not have permission to ${action}`, requirementFor(key));
}
