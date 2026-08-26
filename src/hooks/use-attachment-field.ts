"use client";

import { useCallback, useMemo } from "react";
import { attachmentFromAsset, attachmentsOf } from "@/lib/attachments";
import { fileService } from "@/services/file-service";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useUploadStore } from "@/store/upload-store";
import { useUploads, type UploadsView } from "@/hooks/use-uploads";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { CellAttachment } from "@/types";

export interface AttachmentField {
  readonly files: readonly CellAttachment[];
  /** Upload tasks for this field only — progress, failures and retries. */
  readonly uploads: UploadsView;
  readonly canAddMore: boolean;
  readonly remaining: number;
  readonly upload: (picked: readonly File[]) => Promise<void>;
  readonly remove: (attachmentId: string) => void;
  readonly retry: (taskId: string) => void;
  readonly dismiss: (taskId: string) => void;
}

/**
 * One attachment column of one record, as a live field.
 *
 * Both surfaces that show attachments — the table cell and the drawer section —
 * call this hook with the same row and column, so they read the same
 * `CellValue` and write through the same `editCells`. Uploading from the cell
 * is visible in the drawer, and the other way round, because there is only one
 * place the data lives.
 *
 * Uploads run through the shared upload store and are tagged per field, so a
 * transfer keeps its progress and its retry even if the drawer is closed and
 * reopened mid-flight.
 */
export function useAttachmentField(
  rowId: string,
  columnId: string,
  maxFiles: number,
  folderId: string | null,
): AttachmentField {
  const row = useBoardStore(selectRow(rowId));
  const editCells = useBoardStore((state) => state.editCells);
  const startUploads = useUploadStore((state) => state.startUploads);
  const retryUpload = useUploadStore((state) => state.retryUpload);
  const removeTask = useUploadStore((state) => state.removeTask);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const tag = `cell:${rowId}:${columnId}`;
  const uploads = useUploads(tag);

  const files = useMemo(() => attachmentsOf(row, columnId), [row, columnId]);
  const remaining = Math.max(0, maxFiles - files.length);

  const commit = useCallback(
    (next: readonly CellAttachment[]) => {
      void editCells([{ rowId, columnId, value: { kind: "attachment", attachments: next } }]);
    },
    [editCells, rowId, columnId],
  );

  const upload = useCallback(
    async (picked: readonly File[]) => {
      if (picked.length === 0) return;

      // Read the current value at call time: two drops in quick succession must
      // not both start from the same stale list and lose one another's files.
      const current = attachmentsOf(useBoardStore.getState().rowsById[rowId], columnId);
      const room = Math.max(0, maxFiles - current.length);

      if (room === 0) {
        pushFeedback(`This field holds at most ${maxFiles} files`, "error");
        return;
      }

      if (picked.length > room) {
        pushFeedback(`Only ${room} more file${room === 1 ? "" : "s"} fit here`, "info");
      }

      const assets = await startUploads(picked.slice(0, room), folderId, {
        tag,
        openPanel: false,
      });
      if (assets.length === 0) return;

      const added = assets.map((asset) => {
        const url = fileService.getAssetUrl(asset.id);
        return attachmentFromAsset(asset, url, asset.kind === "image" ? url : null);
      });

      const latest = attachmentsOf(useBoardStore.getState().rowsById[rowId], columnId);
      commit([...latest, ...added]);
    },
    [rowId, columnId, maxFiles, startUploads, folderId, tag, commit, pushFeedback],
  );

  const remove = useCallback(
    (attachmentId: string) => {
      const current = attachmentsOf(useBoardStore.getState().rowsById[rowId], columnId);
      commit(current.filter((file) => file.id !== attachmentId));
    },
    [rowId, columnId, commit],
  );

  return {
    files,
    uploads,
    canAddMore: remaining > 0,
    remaining,
    upload,
    remove,
    retry: retryUpload,
    dismiss: removeTask,
  };
}
