"use client";

import { create } from "zustand";
import { partitionUploads } from "@/lib/file-validation";
import { capabilitiesFor } from "@/lib/permissions";
import { findNodeById } from "@/lib/tree";
import {
  createUploadTask,
  isTaskActive,
  summarizeUploads,
  uploadQueueReducer,
  type UploadEvent,
} from "@/lib/upload-queue";
import type { UploadReference } from "@/services/api/file.api";
import { fileService } from "@/services/file-service";
import { isCancellation, toAppError } from "@/services/errors";
import { getActiveTree, selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { FileAsset, UploadSummary, UploadTask } from "@/types";
import { currentUser } from "@/store/session-store";

const controllers = new Map<string, AbortController>();

let taskSequence = 0;

function nextTaskId(): string {
  taskSequence += 1;
  return `upload_${taskSequence.toString(36)}`;
}

interface UploadState {
  readonly tasks: readonly UploadTask[];
  readonly isPanelOpen: boolean;
}

interface UploadActions {
  startUploads: (
    files: readonly File[],
    folderId: string | null,
    options?: UploadOptions,
  ) => Promise<readonly FileAsset[]>;
  uploadOne: (
    file: File,
    folderId: string | null,
    reference?: UploadReference,
  ) => Promise<FileAsset | null>;
  cancelUpload: (taskId: string) => void;
  retryUpload: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearFinished: () => void;
  setPanelOpen: (isOpen: boolean) => void;
}

export interface UploadOptions {
  readonly tag?: string;
  readonly openPanel?: boolean;
  /** Chỗ tệp thuộc về — xem `UploadReference`. Bỏ trống là tải vào Drive. */
  readonly reference?: UploadReference;
}

export type UploadStore = UploadState & UploadActions;

export const useUploadStore = create<UploadStore>()((set, get) => {
  const dispatch = (event: UploadEvent) =>
    set((state) => ({ tasks: uploadQueueReducer(state.tasks, event) }));

  const retryPayloads = new Map<
    string,
    { file: File; folderId: string | null; reference?: UploadReference }
  >();

  async function run(
    task: UploadTask,
    file: File,
    folderId: string | null,
    reference?: UploadReference,
  ): Promise<FileAsset | null> {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    dispatch({ type: "start", id: task.id });

    try {
      const completed = await fileService.upload({
        file,
        folderId,
        ...(reference === undefined ? {} : { reference }),
        onProgress: (progress) => dispatch({ type: "progress", id: task.id, progress }),
        signal: controller.signal,
      });

      // `node === null` nghĩa là tệp nằm bên trong một ô, một khối hay một bình
      // luận. Nhét nó vào cây là dựng lại đúng thứ server vừa từ chối tạo.
      if (completed.node) {
        useWorkspaceStore.getState().addUploadedAsset(folderId, completed);
      } else {
        useWorkspaceStore.getState().applyStorageUsage(completed.storage);
      }
      dispatch({ type: "success", id: task.id, assetId: completed.asset.id });
      return completed.asset;
    } catch (error) {
      const appError = toAppError(error);
      if (isCancellation(appError)) {
        dispatch({ type: "cancel", id: task.id });
      } else {
        dispatch({ type: "error", id: task.id, error: appError });
      }
      return null;
    } finally {
      controllers.delete(task.id);
      retryPayloads.set(task.id, {
        file,
        folderId,
        ...(reference === undefined ? {} : { reference }),
      });
    }
  }

  return {
    tasks: [],
    isPanelOpen: false,

    startUploads: async (files, folderId, options = {}) => {
      if (files.length === 0) return [];

      const workspace = useWorkspaceStore.getState();

      if (!canUploadTo(folderId)) {
        workspace.pushFeedback("You do not have permission to upload here", "error");
        return [];
      }

      const { accepted, rejected } = partitionUploads(files);

      for (const rejection of rejected) {
        workspace.pushFeedback(rejection.error.message, "error");
      }

      if (accepted.length === 0) return [];

      const reference = options.reference;
      const tasks = accepted.map((file) => createUploadTask(nextTaskId(), file, folderId, options.tag));
      tasks.forEach((task, index) => {
        const file = accepted[index];
        if (file) {
          retryPayloads.set(task.id, {
            file,
            folderId,
            ...(reference === undefined ? {} : { reference }),
          });
        }
      });

      dispatch({ type: "enqueue", tasks });
      if (options.openPanel !== false) set({ isPanelOpen: true });

      const results = await Promise.all(
        tasks.map((task, index) => {
          const file = accepted[index];
          return file ? run(task, file, folderId, reference) : Promise.resolve(null);
        }),
      );

      const assets = results.filter((asset): asset is FileAsset => asset !== null);
      if (assets.length > 0) {
        workspace.pushFeedback(
          `Uploaded ${assets.length} ${assets.length === 1 ? "file" : "files"}`,
          "success",
        );
      }

      return assets;
    },

    uploadOne: async (file, folderId, reference) => {
      const [asset] = await get().startUploads([file], folderId, {
        ...(reference === undefined ? {} : { reference }),
      });
      return asset ?? null;
    },

    cancelUpload: (taskId) => {
      controllers.get(taskId)?.abort();
      dispatch({ type: "cancel", id: taskId });
    },

    retryUpload: (taskId) => {
      const payload = retryPayloads.get(taskId);
      const task = get().tasks.find((candidate) => candidate.id === taskId);
      if (!payload || !task) return;

      dispatch({ type: "retry", id: taskId });
      void run(
        { ...task, status: "queued", progress: 0 },
        payload.file,
        payload.folderId,
        payload.reference,
      );
    },

    removeTask: (taskId) => {
      controllers.get(taskId)?.abort();
      retryPayloads.delete(taskId);
      dispatch({ type: "remove", id: taskId });
    },

    clearFinished: () => {
      for (const task of get().tasks) {
        if (!isTaskActive(task)) retryPayloads.delete(task.id);
      }
      dispatch({ type: "clear-finished" });
    },

    setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
  };
});

function canUploadTo(folderId: string | null): boolean {
  const state = useWorkspaceStore.getState();
  const workspace = selectActiveWorkspace(state);
  const role = workspace.members.find((member) => member.id === currentUser().id)?.role ?? "viewer";
  const node = folderId ? findNodeById(getActiveTree(), folderId) : null;

  if (folderId && !node) return false;
  return capabilitiesFor({ role, user: currentUser(), node }).upload;
}

export const selectUploadSummary = (state: UploadStore): UploadSummary =>
  summarizeUploads(state.tasks);

export const selectHasActiveUploads = (state: UploadStore): boolean =>
  state.tasks.some(isTaskActive);
