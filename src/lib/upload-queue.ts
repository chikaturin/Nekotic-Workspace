import type { AppError, UploadStatus, UploadSummary, UploadTask } from "@/types";

const ACTIVE_STATUSES: readonly UploadStatus[] = ["queued", "uploading"];

export function createUploadTask(
  id: string,
  file: File,
  folderId: string | null,
  tag?: string,
): UploadTask {
  return {
    id,
    fileName: file.name,
    folderId,
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    progress: 0,
    status: "queued",
    error: null,
    assetId: null,
    ...(tag ? { tag } : {}),
  };
}

export type UploadEvent =
  | { readonly type: "enqueue"; readonly tasks: readonly UploadTask[] }
  | { readonly type: "start"; readonly id: string }
  | { readonly type: "progress"; readonly id: string; readonly progress: number }
  | { readonly type: "success"; readonly id: string; readonly assetId: string }
  | { readonly type: "error"; readonly id: string; readonly error: AppError }
  | { readonly type: "cancel"; readonly id: string }
  | { readonly type: "retry"; readonly id: string }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "clear-finished" };

/** Pure upload queue. The service performs I/O; this only tracks state. */
export function uploadQueueReducer(
  tasks: readonly UploadTask[],
  event: UploadEvent,
): readonly UploadTask[] {
  switch (event.type) {
    case "enqueue":
      return [...tasks, ...event.tasks];

    case "start":
      return patch(tasks, event.id, (task) => ({ ...task, status: "uploading", error: null }));

    case "progress":
      return patch(tasks, event.id, (task) =>
        task.status === "cancelled"
          ? task
          : { ...task, status: "uploading", progress: clamp(event.progress) },
      );

    case "success":
      return patch(tasks, event.id, (task) => ({
        ...task,
        status: "success",
        progress: 1,
        assetId: event.assetId,
        error: null,
      }));

    case "error":
      return patch(tasks, event.id, (task) => ({ ...task, status: "error", error: event.error }));

    case "cancel":
      return patch(tasks, event.id, (task) =>
        task.status === "success" ? task : { ...task, status: "cancelled", error: null },
      );

    case "retry":
      return patch(tasks, event.id, (task) => ({
        ...task,
        status: "queued",
        progress: 0,
        error: null,
      }));

    case "remove":
      return tasks.filter((task) => task.id !== event.id);

    case "clear-finished":
      return tasks.filter((task) => ACTIVE_STATUSES.includes(task.status));
  }
}

function patch(
  tasks: readonly UploadTask[],
  id: string,
  updater: (task: UploadTask) => UploadTask,
): readonly UploadTask[] {
  const next = tasks.map((task) => (task.id === id ? updater(task) : task));
  return next.some((task, index) => task !== tasks[index]) ? next : tasks;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Aggregate view used by the upload banner and the progress bar. */
export function summarizeUploads(tasks: readonly UploadTask[]): UploadSummary {
  const total = tasks.length;
  const active = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status)).length;
  const completed = tasks.filter((task) => task.status === "success").length;
  const failed = tasks.filter((task) => task.status === "error").length;
  const progress =
    total === 0 ? 0 : tasks.reduce((sum, task) => sum + task.progress, 0) / total;

  return { total, active, completed, failed, progress };
}

export const isTaskActive = (task: UploadTask): boolean => ACTIVE_STATUSES.includes(task.status);
export const isTaskFinished = (task: UploadTask): boolean => !ACTIVE_STATUSES.includes(task.status);
