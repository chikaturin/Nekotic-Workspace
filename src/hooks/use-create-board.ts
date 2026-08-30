"use client";

import { useCallback, useState } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
import { hrefForNode } from "@/lib/tree";
import { getActiveTree, useWorkspaceStore } from "@/store/workspace-store";
import type { BoardTemplate } from "@/types";

export function useCreateBoard(): {
  createBoard: (
    parentId: string | null,
    template: BoardTemplate,
    name?: string,
  ) => void;
  isCreating: boolean;
} {
  const openNode = useOpenNode();
  const [isCreating, setIsCreating] = useState(false);
  const createNode = useWorkspaceStore((state) => state.createBoard);

  const createBoard = useCallback(
    async (parentId: string | null, template: BoardTemplate, name?: string) => {
      setIsCreating(true);

      try {
        const node = await createNode(parentId, name ?? template.name, template.id);
        if (node) openNode(hrefForNode(getActiveTree(), node.id));
      } finally {
        setIsCreating(false);
      }
    },
    [createNode, openNode],
  );

  return { createBoard, isCreating };
}
