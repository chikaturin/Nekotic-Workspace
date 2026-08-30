"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lock, X } from "lucide-react";
import { useMemo } from "react";
import { FileDropzone } from "@/components/files/file-dropzone";
import { UploadTaskRow } from "@/components/files/upload-task-row";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/file-validation";
import { summarizeUploads } from "@/lib/upload-queue";
import { formatBytes, formatCount, formatPercent } from "@/lib/format";
import { useUploadStore } from "@/store/upload-store";
import type { UploadTask } from "@/types";

interface UploadDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly folderId: string | null;
  readonly folderName: string;
  readonly canUpload: boolean;
}

export function UploadDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
  canUpload,
}: UploadDialogProps) {
  const tasks = useUploadStore((state) => state.tasks);
  const cancelUpload = useUploadStore((state) => state.cancelUpload);
  const retryUpload = useUploadStore((state) => state.retryUpload);
  const removeTask = useUploadStore((state) => state.removeTask);
  const clearFinished = useUploadStore((state) => state.clearFinished);

  const scoped = useMemo<readonly UploadTask[]>(
    () => tasks.filter((task) => task.folderId === folderId),
    [tasks, folderId],
  );

  const summary = useMemo(() => summarizeUploads(scoped), [scoped]);
  const hasTasks = scoped.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background p-0">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-title font-semibold tracking-tight text-foreground">
              Add files
            </DialogTitle>
            <DialogDescription className="metric truncate text-body text-faint-foreground">
              Destination · {folderName}
            </DialogDescription>
          </div>

          <Button size="icon-sm" variant="ghost" aria-label="Close uploader" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </header>

        <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 p-6">
            {canUpload ? (
              <FileDropzone
                folderId={folderId}
                canUpload={canUpload}
                tone="hero"
                className={hasTasks ? "" : "min-h-64 flex-1"}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/60 p-10 text-center">
                <Lock className="size-8 text-faint-foreground" strokeWidth={1.5} />
                <p className="text-lead font-medium text-foreground">Uploads are not allowed here</p>
                <p className="max-w-sm text-lead text-muted-foreground">
                  You do not have permission to add files to “{folderName}”. Ask a workspace admin
                  for access.
                </p>
              </div>
            )}

            {!hasTasks && canUpload && <AcceptedTypes />}

            <AnimatePresence initial={false}>
              {hasTasks && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  aria-label="Uploads"
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                    <h2 className="text-lead font-medium text-foreground">
                      {formatCount(scoped.length, "file")}
                    </h2>
                    {summary.active > 0 && (
                      <span className="metric text-body text-faint-foreground">
                        {formatPercent(summary.progress)} · {summary.active} in flight
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      disabled={summary.active > 0}
                      onClick={clearFinished}
                    >
                      Clear finished
                    </Button>
                  </div>

                  {summary.active > 0 && <Progress value={summary.progress} className="h-0.5 rounded-none" />}

                  <ul className="divide-y divide-hairline p-1">
                    {scoped.map((task) => (
                      <UploadTaskRow
                        key={task.id}
                        task={task}
                        onCancel={cancelUpload}
                        onRetry={retryUpload}
                        onRemove={removeTask}
                      />
                    ))}
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2.5">
          <span className="metric text-body text-faint-foreground">
            {summary.completed > 0 && (
              <span className="inline-flex items-center gap-1 text-success">
                <CheckCircle2 className="size-3.5" />
                {formatCount(summary.completed, "file")} uploaded
              </span>
            )}
            {summary.completed > 0 && summary.failed > 0 && " · "}
            {summary.failed > 0 && (
              <span className="text-danger">{formatCount(summary.failed, "failure")}</span>
            )}
            {summary.completed === 0 && summary.failed === 0 && "Nothing uploaded yet"}
          </span>

          <Button size="sm" variant="default" className="ml-auto" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

const TYPE_GROUPS: readonly { label: string; extensions: readonly string[] }[] = [
  { label: "Documents", extensions: ACCEPTED_EXTENSIONS.documents },
  { label: "Images", extensions: ACCEPTED_EXTENSIONS.images },
  { label: "Data", extensions: ACCEPTED_EXTENSIONS.data },
  { label: "Source code", extensions: ACCEPTED_EXTENSIONS.code },
];

function AcceptedTypes() {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lead font-medium text-foreground">What you can upload</h2>
        <span className="metric text-body text-faint-foreground">
          up to {formatBytes(MAX_UPLOAD_BYTES)} per file
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {TYPE_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <dt className="text-micro font-semibold uppercase tracking-wider text-faint-foreground">
              {group.label}
            </dt>
            <dd className="flex flex-wrap gap-1">
              {group.extensions.map((extension) => (
                <span
                  key={extension}
                  className="metric rounded border border-border bg-background px-1.5 py-0.5 text-micro uppercase text-muted-foreground"
                >
                  {extension}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-ui text-muted-foreground">
        Uploads keep running while you work — close this page any time and watch progress in the
        tray.
      </p>
    </section>
  );
}
