"use client";

import { useCallback, useState } from "react";
import { templateFileName, type FileTemplate } from "@/lib/file-templates";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { toAppError } from "@/services/errors";
import { fileService } from "@/services/file-service";
import { getActiveTree, useWorkspaceStore } from "@/store/workspace-store";
import { childrenOf, type DriveNode } from "@/types";

/**
 * Create a blank file of a chosen type inside a folder, then open it in the
 * viewer so it can be edited straight away. One place, so every entry point
 * (sidebar, drive toolbar) behaves the same.
 */
export function useCreateFile(): {
  createFile: (parentId: string | null, template: FileTemplate) => Promise<void>;
  isCreating: boolean;
} {
  const [isCreating, setIsCreating] = useState(false);
  const addUploadedAsset = useWorkspaceStore((state) => state.addUploadedAsset);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const createFile = useCallback(
    async (parentId: string | null, template: FileTemplate) => {
      setIsCreating(true);

      try {
        const name = templateFileName(template, siblingNames(parentId));
        const asset = await fileService.createBlank({
          template,
          name,
          folderId: parentId,
          owner: CURRENT_USER,
        });

        const nodeId = addUploadedAsset(parentId, asset);
        pushFeedback(`Created “${name}”`, "success");
        openPreview(nodeId);
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setIsCreating(false);
      }
    },
    [addUploadedAsset, openPreview, pushFeedback],
  );

  return { createFile, isCreating };
}

function siblingNames(parentId: string | null): readonly string[] {
  const tree = getActiveTree();
  const parent: DriveNode | null = parentId ? findNodeById(tree, parentId) : null;
  const pool = parent ? childrenOf(parent) : tree;

  return pool.map((node) => node.name);
}
