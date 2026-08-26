"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { emptyDocumentBlocks } from "@/lib/blocks";
import { hrefForNode } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { documentService } from "@/services/document-service";
import { toAppError } from "@/services/errors";
import { getActiveTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DocumentKind } from "@/types";

const ICONS: Readonly<Record<DocumentKind, string>> = {
  page: "📄",
  config: "⚙️",
  secret: "🔐",
};

/**
 * Create a page: a node in the tree plus its content in the document service,
 * then navigate to it. Kept in one place so every entry point behaves the same.
 */
export function useCreateDocument(): {
  createDocument: (
    parentId: string | null,
    name?: string,
    kind?: DocumentKind,
  ) => Promise<void>;
  isCreating: boolean;
} {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const createNode = useWorkspaceStore((state) => state.createDocument);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const createDocument = useCallback(
    async (parentId: string | null, name = "Untitled", kind: DocumentKind = "page") => {
      setIsCreating(true);

      try {
        const node = createNode(parentId, name, ICONS[kind], kind);
        if (!node) return;

        // Config and secret documents are seeded by their own service.
        if (kind !== "page") {
          router.push(hrefForNode(getActiveTree(), node.id));
          return;
        }

        let blockSeed = 0;
        await documentService.create({
          nodeId: node.id,
          workspaceId: node.workspaceId,
          title: node.name,
          icon: node.icon,
          owner: CURRENT_USER,
          blocks: emptyDocumentBlocks(() => `blk_${node.id}_${(blockSeed += 1).toString(36)}`),
        });

        router.push(hrefForNode(getActiveTree(), node.id));
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setIsCreating(false);
      }
    },
    [createNode, pushFeedback, router],
  );

  return { createDocument, isCreating };
}
