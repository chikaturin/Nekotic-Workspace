"use client";

import { useCallback, useState } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
import { emptyDocumentBlocks } from "@/lib/blocks";
import { hrefForNode } from "@/lib/tree";
import { devtoolsService } from "@/services/devtools-service";
import { documentService } from "@/services/document-service";
import { toAppError } from "@/services/errors";
import { getActiveTree, useWorkspaceStore } from "@/store/workspace-store";
import type { ConfigFormat, DocumentKind } from "@/types";

const ICONS: Readonly<Record<DocumentKind, string>> = {
  page: "📄",
  config: "⚙️",
  secret: "🔐",
};

export function useCreateDocument(): {
  createDocument: (
    parentId: string | null,
    name?: string,
    kind?: DocumentKind,
    format?: ConfigFormat,
  ) => Promise<void>;
  isCreating: boolean;
} {
  const openNode = useOpenNode();
  const [isCreating, setIsCreating] = useState(false);
  const createNode = useWorkspaceStore((state) => state.createDocument);
  const requestTitleFocus = useWorkspaceStore((state) => state.requestTitleFocus);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const createDocument = useCallback(
    async (
      parentId: string | null,
      name = "Untitled",
      kind: DocumentKind = "page",
      format?: ConfigFormat,
    ) => {
      setIsCreating(true);

      try {
        const node = await createNode(parentId, name, ICONS[kind], kind);
        if (!node) return;

        requestTitleFocus(node.id);

        if (kind !== "page") {
          if (kind === "config" && format) {
            await devtoolsService.createConfig({ nodeId: node.id, format });
          }
          openNode(hrefForNode(getActiveTree(), node.id));
          return;
        }

        let blockSeed = 0;
        await documentService.create({
          nodeId: node.id,
          title: node.name,
          icon: node.icon,
          blocks: emptyDocumentBlocks(() => `blk_${node.id}_${(blockSeed += 1).toString(36)}`),
        });

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
