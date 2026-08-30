"use client";

import { useMemo } from "react";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { DirectoryUser } from "@/types";

export function useDirectory(): readonly DirectoryUser[] {
  const workspace = useWorkspaceStore(selectActiveWorkspace);

  return useMemo(
    () => workspace.members.map((member) => ({ ...member, isActive: true })),
    [workspace.members],
  );
}
