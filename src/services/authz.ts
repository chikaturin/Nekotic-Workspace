import { inheritedArchiveOf } from "@/lib/archive";
import { can, effectiveAccess, requirementFor } from "@/lib/permissions";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { permissionDenied } from "@/services/errors";
import { usePermissionStore } from "@/store/permission-store";
import {
  getFullTree,
  selectActiveWorkspace,
  useWorkspaceStore,
} from "@/store/workspace-store";
import type { PermissionKey } from "@/types";

/**
 * The server side of a permission (SY-RBC-42).
 *
 * Hiding a button is a courtesy. This is the refusal — the call that a request
 * has to get past whether it came from the app's own UI, from a stale tab whose
 * role was downgraded a minute ago, or from a console. It answers the question
 * with the *same* evaluator the UI asks: one matrix, one inheritance chain, one
 * `can`, so a control that is offered and a call that is accepted cannot drift
 * apart the way two copies of a rule always eventually do.
 *
 * It resolves the caller itself rather than taking a role as an argument. A
 * role the client sends is a claim, not a fact, and an endpoint that trusts one
 * is not enforcing anything — it is asking the caller how much access they
 * would like.
 *
 * The honest caveat: there is no server here. This module reads the same
 * process's stores, so it is a faithful *model* of the check a real API must
 * make, not a substitute for it. The endpoints it guards are listed in the API
 * report as still needing the real thing.
 */

/** The caller's effective role on a node, through the inheritance chain. */
function contextFor(nodeId: string | null) {
  const state = useWorkspaceStore.getState();
  const workspace = selectActiveWorkspace(state);
  const tree = getFullTree();
  const rules = usePermissionStore.getState().rulesByWorkspace[workspace.id] ?? {};

  const { role } = effectiveAccess(
    { tree, nodeId, rules, members: workspace.members },
    { kind: "user", userId: CURRENT_USER.id },
  );

  return {
    role,
    user: CURRENT_USER,
    node: nodeId ? findNodeById(tree, nodeId) : null,
    isFrozen: inheritedArchiveOf(tree, nodeId) !== null,
  };
}

/** Whether the caller holds `key` on `nodeId`. Never throws. */
export function callerCan(nodeId: string | null, key: PermissionKey): boolean {
  return can(key, contextFor(nodeId));
}

/**
 * Refuse the call unless the caller holds `key` on `nodeId`.
 *
 * The refusal names the role that would hold the permission and nothing else —
 * not the rule that denied it, not who does hold it. A refusal is not a place
 * to describe the access-control graph to somebody outside it.
 */
export function requirePermission(
  nodeId: string | null,
  key: PermissionKey,
  action: string,
): void {
  if (callerCan(nodeId, key)) return;
  throw permissionDenied(`You do not have permission to ${action}`, requirementFor(key));
}
