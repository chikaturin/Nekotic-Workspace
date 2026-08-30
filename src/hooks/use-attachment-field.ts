"use client";

import { useCallback, useMemo } from "react";
import { attachmentFromAsset, attachmentsOf } from "@/lib/attachments";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useUploadStore } from "@/store/upload-store";
import { useUploads, type UploadsView } from "@/hooks/use-uploads";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { CellAttachment } from "@/types";

export interface AttachmentField {
  readonly files: readonly CellAttachment[];
  readonly uploads: UploadsView;
  readonly canAddMore: boolean;
  readonly remaining: number;
  readonly upload: (picked: readonly File[]) => Promise<void>;
  readonly remove: (attachmentId: string) => void;
  readonly retry: (taskId: string) => void;
  readonly dismiss: (taskId: string) => void;
}

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
        // Tệp thuộc về ô này, không phải Drive: khai chỗ ở thì server không tạo
        // mục trong cây, và thư mục của người dùng không đầy ảnh đính kèm.
        reference: { kind: "cell", rowId, columnId },
      });
      if (assets.length === 0) return;

      const added = assets.map((asset) =>
        attachmentFromAsset(
          asset,
          asset.previewUrl ?? null,
          asset.thumbnailUrl ?? null,
        ),
      );

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
