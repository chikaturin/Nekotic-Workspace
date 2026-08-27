"use client";

import { CircleCheck, CircleX, LoaderCircle, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatPercent } from "@/lib/format";
import { kindFromFileName } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import type { UploadTask } from "@/types";

interface UploadTaskRowProps {
  readonly task: UploadTask;
  readonly onCancel: (taskId: string) => void;
  readonly onRetry: (taskId: string) => void;
  readonly onRemove: (taskId: string) => void;
}

const STATUS_LABEL: Record<UploadTask["status"], string> = {
  queued: "Waiting",
  uploading: "Uploading",
  success: "Uploaded",
  error: "Failed",
  cancelled: "Cancelled",
};

export function UploadTaskRow({ task, onCancel, onRetry, onRemove }: UploadTaskRowProps) {
  const isActive = task.status === "queued" || task.status === "uploading";
  const kind = kindFromFileName(task.fileName);

  return (
    <li className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-hover">
      <span className="mt-0.5 shrink-0">
        {task.status === "success" && <CircleCheck className="size-4 text-success" />}
        {task.status === "error" && <CircleX className="size-4 text-danger" />}
        {isActive && <LoaderCircle className="size-4 animate-spin text-accent" />}
        {task.status === "cancelled" && <X className="size-4 text-faint-foreground" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-lead text-foreground">{task.fileName}</p>
          <span
            className={cn(
              "metric shrink-0 text-micro",
              task.status === "error" ? "text-danger" : "text-faint-foreground",
            )}
          >
            {isActive ? formatPercent(task.progress) : STATUS_LABEL[task.status]}
          </span>
        </div>

        {isActive && (
          <Progress
            value={task.progress}
            className="mt-1.5"
            label={`Uploading ${task.fileName}`}
          />
        )}

        <p className="metric mt-1 truncate text-micro text-faint-foreground">
          {task.status === "error" && task.error
            ? task.error.message
            : `${kind.toUpperCase()} · ${formatBytes(task.sizeBytes)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {task.status === "error" && task.error?.isRetryable && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Retry upload of ${task.fileName}`}
            onClick={() => onRetry(task.id)}
          >
            <RotateCcw />
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={isActive ? `Cancel upload of ${task.fileName}` : `Dismiss ${task.fileName}`}
          onClick={() => (isActive ? onCancel(task.id) : onRemove(task.id))}
        >
          <X />
        </Button>
      </div>
    </li>
  );
}
