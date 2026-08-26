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
import { CURRENT_USER } from "@/mock/users";
import { fileService } from "@/services/file-service";
import { isCancellation, toAppError } from "@/services/errors";
import { getActiveTree, selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { FileAsset, UploadSummary, UploadTask } from "@/types";

/** Abort handles live outside the store — they are not renderable state. */
const controllers = new Map<string, AbortController>();

let taskSequence = 0;

function nextTaskId(): string {
  taskSequence += 1;
  return `upload_${taskSequence.toString(36)}`;
}

interface UploadState {
  readonly tasks: readonly UploadTask[];
  /** Panel opens itself whenever an upload starts. */
  readonly isPanelOpen: boolean;
}

interface UploadActions {
  /** Validate, queue and run uploads. Returns the assets that landed. */
  startUploads: (
    files: readonly File[],
    folderId: string | null,
    options?: { readonly tag?: string; readonly openPanel?: boolean },
  ) => Promise<readonly FileAsset[]>;
  /** Upload a single file and resolve with its asset — used by editor blocks. */
  uploadOne: (file: File, folderId: string | null) => Promise<FileAsset | null>;
  cancelUpload: (taskId: string) => void;
  retryUpload: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearFinished: () => void;
  setPanelOpen: (isOpen: boolean) => void;
}

export type UploadStore = UploadState & UploadActions;

export const useUploadStore = create<UploadStore>()((set, get) => {
  const dispatch = (event: UploadEvent) =>
    set((state) => ({ tasks: uploadQueueReducer(state.tasks, event) }));

  /** Files are kept so a failed task can be retried without re-picking them. */
  const retryPayloads = new Map<string, { file: File; folderId: string | null }>();

  /** Run one queued task to completion, reporting progress as it goes. */
  async function run(task: UploadTask, file: File, folderId: string | null): Promise<FileAsset | null> {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    dispatch({ type: "start", id: task.id });

    try {
      const asset = await fileService.upload({
        file,
        folderId,
        owner: CURRENT_USER,
        onProgress: (progress) => dispatch({ type: "progress", id: task.id, progress }),
        signal: controller.signal,
      });

      useWorkspaceStore.getState().addUploadedAsset(folderId, asset);
      dispatch({ type: "success", id: task.id, assetId: asset.id });
      return asset;
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
      retryPayloads.set(task.id, { file, folderId });
    }
  }

  return {
    tasks: [],
    isPanelOpen: false,

    startUploads: async (files, folderId, options = {}) => {
      if (files.length === 0) return [];

      const workspace = useWorkspaceStore.getState();

      // Every upload path — dropzone, toolbar, drag onto a folder, editor block
      // — funnels through here, so the permission check belongs here too.
      if (!canUploadTo(folderId)) {
        workspace.pushFeedback("You do not have permission to upload here", "error");
        return [];
      }

      const { accepted, rejected } = partitionUploads(files);

      for (const rejection of rejected) {
        workspace.pushFeedback(rejection.error.message, "error");
      }

      if (accepted.length === 0) return [];

      const tasks = accepted.map((file) => createUploadTask(nextTaskId(), file, folderId, options.tag));
      tasks.forEach((task, index) => {
        const file = accepted[index];
        if (file) retryPayloads.set(task.id, { file, folderId });
      });

      dispatch({ type: "enqueue", tasks });
      if (options.openPanel !== false) set({ isPanelOpen: true });

      const results = await Promise.all(
        tasks.map((task, index) => {
          const file = accepted[index];
          return file ? run(task, file, folderId) : Promise.resolve(null);
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

    uploadOne: async (file, folderId) => {
      const [asset] = await get().startUploads([file], folderId);
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
      void run({ ...task, status: "queued", progress: 0 }, payload.file, payload.folderId);
    },

    removeTask: (taskId) => {
      controllers.get(taskId)?.abort();
      retryPayloads.delete(taskId);
      dispatch({ type: "remove", id: taskId });
    },

    clearFinished: () => {
      // Drop the File handles of everything that is leaving the queue.
      for (const task of get().tasks) {
        if (!isTaskActive(task)) retryPayloads.delete(task.id);
      }
      dispatch({ type: "clear-finished" });
    },

    setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
  };
});

/** Whether the signed-in user may upload into a folder (null = workspace root). */
function canUploadTo(folderId: string | null): boolean {
  const state = useWorkspaceStore.getState();
  const workspace = selectActiveWorkspace(state);
  const role = workspace.members.find((member) => member.id === CURRENT_USER.id)?.role ?? "guest";
  const node = folderId ? findNodeById(getActiveTree(), folderId) : null;

  if (folderId && !node) return false;
  return capabilitiesFor({ role, user: CURRENT_USER, node }).upload;
}

export const selectUploadSummary = (state: UploadStore): UploadSummary =>
  summarizeUploads(state.tasks);

export const selectHasActiveUploads = (state: UploadStore): boolean =>
  state.tasks.some(isTaskActive);
