"use client";

import { useMemo } from "react";
import { isTaskActive, summarizeUploads } from "@/lib/upload-queue";
import { useUploadStore } from "@/store/upload-store";
import type { UploadSummary, UploadTask } from "@/types";

export interface UploadsView {
  readonly tasks: readonly UploadTask[];
  readonly summary: UploadSummary;
  readonly hasActive: boolean;
  readonly isPanelOpen: boolean;
}

/** Read-only view of the upload queue, optionally scoped to one tag. */
export function useUploads(tag?: string): UploadsView {
  const allTasks = useUploadStore((state) => state.tasks);
  const isPanelOpen = useUploadStore((state) => state.isPanelOpen);

  return useMemo(() => {
    const tasks = tag === undefined ? allTasks : allTasks.filter((task) => task.tag === tag);

    return {
      tasks,
      summary: summarizeUploads(tasks),
      hasActive: tasks.some(isTaskActive),
      isPanelOpen,
    };
  }, [allTasks, tag, isPanelOpen]);
}
