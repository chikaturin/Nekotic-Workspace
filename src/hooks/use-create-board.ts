"use client";

import { useCallback, useState } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
import { hrefForNode } from "@/lib/tree";
import { getActiveTree, useWorkspaceStore } from "@/store/workspace-store";
import type { BoardTemplate } from "@/types";

/**
 * Create a board from a template and open it.
 *
 * The template supplies the schema once; from then on the board owns its
 * columns, so editing it can never reach the template (DV-TMP-19).
 */
export function useCreateBoard(): {
  createBoard: (parentId: string | null, template: BoardTemplate) => void;
  isCreating: boolean;
} {
  const openNode = useOpenNode();
  const [isCreating, setIsCreating] = useState(false);
  const createNode = useWorkspaceStore((state) => state.createBoard);

  const createBoard = useCallback(
    (parentId: string | null, template: BoardTemplate) => {
      setIsCreating(true);

      try {
        const node = createNode(parentId, template.name, template.id);
        if (node) openNode(hrefForNode(getActiveTree(), node.id));
      } finally {
        setIsCreating(false);
      }
    },
    [createNode, openNode],
  );

  return { createBoard, isCreating };
}
