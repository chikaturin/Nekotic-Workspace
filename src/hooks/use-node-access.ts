"use client";

import { useCallback, useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUserId } from "@/store/session-store";
import { toAppError } from "@/services/errors";
import { effectiveAccess } from "@/lib/permissions";
import { accessModeOf, hasGrantOn } from "@/lib/permissions/visibility";
import { findPathToId } from "@/lib/tree";
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
  readonly isOwner: boolean;
}

export interface NodeAccess {
  readonly canManage: boolean;
  readonly granted: readonly NodeAccessEntry[];
  readonly candidates: readonly WorkspaceMember[];
  readonly inheritedFrom: string | null;
  setMode: (mode: NodeAccessMode) => Promise<void>;
  grant: (userId: string, role: WorkspaceRole) => Promise<void>;
  revoke: (userId: string) => Promise<void>;
}

const NO_ACCESS: NodeAccess = {
  canManage: false,
  granted: [],
  candidates: [],
  inheritedFrom: null,
  setMode: async () => {},
  grant: async () => {},
  revoke: async () => {},
};

export function useNodeAccess(node: DriveNode | null): NodeAccess {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));
  const setAccessRule = usePermissionStore((state) => state.setAccessRule);
  const clearAccessRule = usePermissionStore((state) => state.clearAccessRule);
  const setNodeAccessMode = useWorkspaceStore((state) => state.setNodeAccessMode);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const meId = useCurrentUserId();

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

    const chain = findPathToId(tree, node.id).slice(0, -1);
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const ancestor = chain[index];
      if (ancestor && accessModeOf(ancestor) !== "inherit") return ancestor.name;
    }

    return "the whole workspace";
  }, [tree, node]);

  const setMode = useCallback(
    async (mode: NodeAccessMode) => {
      if (!node || !canManage) return;

      try {
        if (
          mode === "restricted" &&
          !hasGrantOn(rules, node, { kind: "user", userId: meId }, workspace.members)
        ) {
          await setAccessRule(
            workspace.id,
            node,
            { kind: "user", userId: meId },
            workspace.members.find((member) => member.id === meId)?.role ?? "manager",
          );
        }

        await setNodeAccessMode(node.id, mode);
      } catch (error: unknown) {
        pushFeedback(
          `Could not change who can see ${node.name} — ${toAppError(error).message}`,
          "error",
        );

        return;
      }

      if (mode === "restricted") {
        pushFeedback(`${node.name} is now restricted — only the people listed can see it`, "success");
      }
    },
    [node, canManage, rules, workspace, meId, setAccessRule, setNodeAccessMode, pushFeedback],
  );

  const grant = useCallback(
    async (userId: string, role: WorkspaceRole) => {
      if (!node || !canManage) return;

      try {
        await setAccessRule(workspace.id, node, { kind: "user", userId }, role);
      } catch (error: unknown) {
        pushFeedback(`Could not grant access — ${toAppError(error).message}`, "error");
      }
    },
    [node, canManage, workspace.id, setAccessRule, pushFeedback],
  );

  const revoke = useCallback(
    async (userId: string) => {
      if (!node || !canManage) return;

      try {
        await clearAccessRule(workspace.id, node, { kind: "user", userId });
      } catch (error: unknown) {
        pushFeedback(`Could not remove access — ${toAppError(error).message}`, "error");

        return;
      }

      if (granted.length === 1) {
        pushFeedback(
          `${node.name} now has nobody but its owner. An admin can reopen it from Workspace settings.`,
          "info",
        );
      }
    },
    [node, canManage, granted.length, workspace.id, clearAccessRule, pushFeedback],
  );

  if (!node) return NO_ACCESS;

  return { canManage, granted, candidates, inheritedFrom, setMode, grant, revoke };
}
