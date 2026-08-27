"use client";

import { useCallback, useState } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
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
  const openNode = useOpenNode();
  const [isCreating, setIsCreating] = useState(false);
  const createNode = useWorkspaceStore((state) => state.createDocument);
  const requestTitleFocus = useWorkspaceStore((state) => state.requestTitleFocus);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const createDocument = useCallback(
    async (parentId: string | null, name = "Untitled", kind: DocumentKind = "page") => {
      setIsCreating(true);

      try {
        const node = createNode(parentId, name, ICONS[kind], kind);
        if (!node) return;

        // Creating is the first half of writing: the page opens with the
        // caret already in its title, not with a Rename waiting to be found.
        requestTitleFocus(node.id);

        // Config and secret documents are seeded by their own service.
        if (kind !== "page") {
          openNode(hrefForNode(getActiveTree(), node.id));
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

        // A page that has just been made exists only in this tab, so opening
        // it must never become a page load — see `use-open-node`.
        openNode(hrefForNode(getActiveTree(), node.id));
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setIsCreating(false);
      }
    },
    [createNode, requestTitleFocus, pushFeedback, openNode],
  );

  return { createDocument, isCreating };
}
