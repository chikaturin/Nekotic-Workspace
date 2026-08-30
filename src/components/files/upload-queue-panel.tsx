"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { UploadTaskRow } from "@/components/files/upload-task-row";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploads } from "@/hooks/use-uploads";
import { formatCount } from "@/lib/format";
import { useUploadStore } from "@/store/upload-store";

export function UploadQueuePanel() {
  const { tasks, summary, hasActive, isPanelOpen } = useUploads();
  const setPanelOpen = useUploadStore((state) => state.setPanelOpen);
  const cancelUpload = useUploadStore((state) => state.cancelUpload);
  const retryUpload = useUploadStore((state) => state.retryUpload);
  const removeTask = useUploadStore((state) => state.removeTask);
  const clearFinished = useUploadStore((state) => state.clearFinished);

  const isVisible = tasks.length > 0;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-toast w-[min(22rem,calc(100vw-2rem))]">
      <AnimatePresence>
        {isVisible && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            aria-label="Upload queue"
            className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-elevated shadow-float"
          >
            <header className="flex items-center gap-2 border-b border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lead font-medium text-foreground">
                  {hasActive
                    ? `Uploading ${formatCount(summary.active, "file")}`
                    : `${formatCount(summary.completed, "file")} uploaded`}
                </p>
                {summary.failed > 0 && (
                  <p className="metric text-micro text-danger">
                    {formatCount(summary.failed, "failure")}
                  </p>
                )}
              </div>

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={isPanelOpen ? "Collapse upload list" : "Expand upload list"}
                aria-expanded={isPanelOpen}
                onClick={() => setPanelOpen(!isPanelOpen)}
              >
                <ChevronDown className={isPanelOpen ? "" : "rotate-180"} />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Clear finished uploads"
                onClick={clearFinished}
              >
                <X />
              </Button>
            </header>

            {hasActive && <Progress value={summary.progress} className="h-0.5 rounded-none" />}

            <AnimatePresence initial={false}>
              {isPanelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <ul className="max-h-72 overflow-y-auto p-1">
                    {tasks.map((task) => (
                      <UploadTaskRow
                        key={task.id}
                        task={task}
                        onCancel={cancelUpload}
                        onRetry={retryUpload}
                        onRemove={removeTask}
                      />
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
