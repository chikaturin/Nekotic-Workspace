"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { ANONYMOUS_USER, useCurrentUser } from "@/store/session-store";
import { canToggleLock } from "@/lib/permissions";
import { useOpenNode } from "@/hooks/use-open-node";
import { hrefForNode } from "@/lib/tree";
import { documentService } from "@/services/document-service";
import { toAppError } from "@/services/errors";
import { getActiveTree, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DocumentActionId, DriveNode, WorkspaceDocument } from "@/types";

interface UseDocumentActionsInput {
  readonly node: DriveNode | null;
  readonly document: WorkspaceDocument | null;
  readonly onDocumentChanged: (document: WorkspaceDocument) => void;
}

export interface DocumentActions {
  readonly pending: DocumentActionId | null;
  readonly canToggleLock: boolean;
  readonly togglePin: () => Promise<void>;
  readonly toggleLock: () => Promise<void>;
  readonly duplicate: () => Promise<void>;
  readonly setArchived: (isArchived: boolean) => Promise<void>;
  readonly remove: () => Promise<void>;
  readonly move: (targetFolderId: string | null) => void;
}

export function useDocumentActions({
  node,
  document,
  onDocumentChanged,
}: UseDocumentActionsInput): DocumentActions {
  const router = useRouter();
  const openNode = useOpenNode();
  const can = usePermissions(node);
  const me = useCurrentUser() ?? ANONYMOUS_USER;
  const [pending, setPending] = useState<DocumentActionId | null>(null);

  const tree = useWorkspaceStore(selectTree);
  const refreshTree = useWorkspaceStore((state) => state.hydrate);
  const moveNode = useWorkspaceStore((state) => state.moveNode);
  const trashNode = useWorkspaceStore((state) => state.trashNode);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const run = useCallback(
    async (id: DocumentActionId, task: () => Promise<void>) => {
      setPending(id);
      try {
        await task();
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setPending(null);
      }
    },
    [pushFeedback],
  );

  const togglePin = useCallback(async () => {
    if (!document) return;
    await run(document.isPinned ? "unpin" : "pin", async () => {
      const updated = await documentService.setPinned(document.nodeId, !document.isPinned);
      onDocumentChanged(updated);
      pushFeedback(updated.isPinned ? "Page pinned" : "Page unpinned", "info");
    });
  }, [document, onDocumentChanged, pushFeedback, run]);

  const toggleLock = useCallback(async () => {
    if (!document) return;
    await run(document.isLocked ? "unlock" : "lock", async () => {
      const updated = await documentService.setLocked(
        document.nodeId,
        !document.isLocked,
      );
      onDocumentChanged(updated);
      pushFeedback(updated.isLocked ? "Page locked — editing is off" : "Page unlocked", "info");
    });
  }, [document, onDocumentChanged, pushFeedback, run]);

  const duplicate = useCallback(async () => {
    if (!document || !node) return;
    await run("duplicate", async () => {
      const clone = await documentService.duplicate(node.id);

      await refreshTree();
      openNode(hrefForNode(getActiveTree(), clone.id));
    });
  }, [document, node, openNode, refreshTree, run]);

  const setArchived = useCallback(
    async (isArchived: boolean) => {
      if (!document) return;
      await run(isArchived ? "archive" : "restore", async () => {
        await documentService.setArchived(document.nodeId, isArchived);

        onDocumentChanged(await documentService.get(document.nodeId));
        pushFeedback(isArchived ? "Page archived" : "Page restored", "info");
        if (isArchived) router.push("/archive");
      });
    },
    [document, onDocumentChanged, pushFeedback, router, run],
  );

  const remove = useCallback(async () => {
    if (!node) return;
    await run("delete", async () => {
      const parentHref = node.parentId ? hrefForNode(tree, node.parentId) : "/drive";
      trashNode(node.id);
      openNode(parentHref);
    });
  }, [node, tree, trashNode, openNode, run]);

  const move = useCallback(
    (targetFolderId: string | null) => {
      if (!node) return;
      moveNode(node.id, targetFolderId);
      openNode(hrefForNode(getActiveTree(), node.id));
    },
    [moveNode, node, openNode],
  );

  return {
    pending,
    canToggleLock: document ? canToggleLock(can, document, me) : false,
    togglePin,
    toggleLock,
    duplicate,
    setArchived,
    remove,
    move,
  };
}
