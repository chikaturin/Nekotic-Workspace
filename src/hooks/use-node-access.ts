"use client";

import { useCallback, useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { effectiveAccess } from "@/lib/permissions";
import { accessModeOf, hasGrantOn } from "@/lib/permissions/visibility";
import { findPathToId } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { selectRulesFor, usePermissionStore } from "@/store/permission-store";
import {
  selectActiveWorkspace,
  selectFullTree,
  useWorkspaceStore,
} from "@/store/workspace-store";
import type {
  DriveNode,
  NodeAccessMode,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types";

export interface NodeAccessEntry {
  readonly user: WorkspaceMember;
  readonly role: WorkspaceRole;
  /** Owners are always in, and cannot be removed from their own item. */
  readonly isOwner: boolean;
}

export interface NodeAccess {
  readonly canManage: boolean;
  /** People granted here — the list the dialog shows. */
  readonly granted: readonly NodeAccessEntry[];
  /** Workspace members not yet granted, for the add box. */
  readonly candidates: readonly WorkspaceMember[];
  /** Name of the ancestor an inheriting node currently follows, if any. */
  readonly inheritedFrom: string | null;
  setMode: (mode: NodeAccessMode) => void;
  grant: (userId: string, role: WorkspaceRole) => void;
  revoke: (userId: string) => void;
}

const NO_ACCESS: NodeAccess = {
  canManage: false,
  granted: [],
  candidates: [],
  inheritedFrom: null,
  setMode: () => {},
  grant: () => {},
  revoke: () => {},
};

/**
 * Everything the access dialog needs, in one place.
 *
 * It works on *any* node, not only a folder. `accessMode` has always been on
 * the base node type and `visibility.ts` has always walked every node in the
 * chain without asking whether it holds children — the restriction was only
 * ever in the menu that opened this. A single `.env` file being readable by
 * everyone who can reach its folder is exactly the case the model was built
 * for, and exactly the one the UI would not let you write.
 *
 * The rule worth stating: **switching to Restricted grants the actor first**.
 * Something you cannot see is something you cannot reopen, so the write that
 * could strand somebody carries its own remedy rather than leaving the dialog
 * to notice afterwards — the same reason the owner is always admitted.
 *
 * Mode lives on the node and grants live in the rule table, which is why this
 * hook talks to both stores. Nothing else has to know they are separate.
 */
export function useNodeAccess(node: DriveNode | null): NodeAccess {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));
  const setAccessRule = usePermissionStore((state) => state.setAccessRule);
  const clearAccessRule = usePermissionStore((state) => state.clearAccessRule);
  const setNodeAccessMode = useWorkspaceStore((state) => state.setNodeAccessMode);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const can = usePermissions(node);
  const canManage = can("node.access.manage") || can("workspace.permission.manage");

  const granted = useMemo<readonly NodeAccessEntry[]>(() => {
    if (!node) return [];

    return workspace.members
      .filter((member) =>
        hasGrantOn(rules, node, { kind: "user", userId: member.id }, workspace.members),
      )
      .map((member) => ({
        user: member,
        isOwner: member.id === node.owner.id,
        role: effectiveAccess(
          { tree, nodeId: node.id, rules, members: workspace.members },
          { kind: "user", userId: member.id },
        ).role,
      }));
  }, [node, rules, workspace.members, tree]);

  const candidates = useMemo(() => {
    const seen = new Set(granted.map((entry) => entry.user.id));
    return workspace.members.filter((member) => !seen.has(member.id));
  }, [granted, workspace.members]);

  const inheritedFrom = useMemo(() => {
    if (!node) return null;

    // The nearest ancestor that actually decides something. An unbroken chain
    // of `inherit` means the workspace itself is what is being followed.
    const chain = findPathToId(tree, node.id).slice(0, -1);
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const ancestor = chain[index];
      if (ancestor && accessModeOf(ancestor) !== "inherit") return ancestor.name;
    }

    return "the whole workspace";
  }, [tree, node]);

  const setMode = useCallback(
    (mode: NodeAccessMode) => {
      if (!node || !canManage) return;

      if (
        mode === "restricted" &&
        !hasGrantOn(rules, node, { kind: "user", userId: CURRENT_USER.id }, workspace.members)
      ) {
        // Grant before restricting, not after: the order is what makes it
        // impossible to lock yourself out with one dropdown.
        setAccessRule(
          workspace.id,
          node,
          { kind: "user", userId: CURRENT_USER.id },
          workspace.members.find((member) => member.id === CURRENT_USER.id)?.role ?? "manager",
        );
      }

      setNodeAccessMode(node.id, mode);

      if (mode === "restricted") {
        pushFeedback(`${node.name} is now restricted — only the people listed can see it`, "success");
      }
    },
    [node, canManage, rules, workspace, setAccessRule, setNodeAccessMode, pushFeedback],
  );

  const grant = useCallback(
    (userId: string, role: WorkspaceRole) => {
      if (!node || !canManage) return;
      setAccessRule(workspace.id, node, { kind: "user", userId }, role);
    },
    [node, canManage, workspace.id, setAccessRule],
  );

  const revoke = useCallback(
    (userId: string) => {
      if (!node || !canManage) return;

      // The last person out would leave something only its owner and an admin
      // could reopen. It is allowed, and it is said out loud.
      if (granted.length === 1) {
        pushFeedback(
          `${node.name} now has nobody but its owner. An admin can reopen it from Workspace settings.`,
          "info",
        );
      }

      clearAccessRule(workspace.id, node, { kind: "user", userId });
    },
    [node, canManage, granted.length, workspace.id, clearAccessRule, pushFeedback],
  );

  if (!node) return NO_ACCESS;

  return { canManage, granted, candidates, inheritedFrom, setMode, grant, revoke };
}
