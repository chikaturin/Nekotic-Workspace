"use client";

import { useMemo } from "react";
import { capabilitiesFor } from "@/lib/permissions";
import { CURRENT_USER } from "@/mock/users";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { CapabilitySet, DriveNode, WorkspaceRole } from "@/types";

/** Role of the signed-in user inside the active workspace. */
export function useWorkspaceRole(): WorkspaceRole {
  const workspace = useWorkspaceStore(selectActiveWorkspace);

  return useMemo(
    () => workspace.members.find((member) => member.id === CURRENT_USER.id)?.role ?? "guest",
    [workspace],
  );
}

/**
 * What the current user may do with `node` (or the workspace when omitted).
 * Components branch on these flags — they never re-implement the rules.
 */
export function useCapabilities(node?: DriveNode | null): CapabilitySet {
  const role = useWorkspaceRole();

  return useMemo(
    () => capabilitiesFor({ role, user: CURRENT_USER, node: node ?? null }),
    [role, node],
  );
}
