"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { hasExternalFiles, readDroppedFiles } from "@/lib/dnd";
import { cn } from "@/lib/utils";

interface UploadDropTargetProps {
  readonly onFiles: (files: readonly File[]) => void;
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Turns a whole region into a drop surface. Dropping anywhere on it hands the
 * files to the host, which is what opens the full-page uploader.
 */
export function UploadDropTarget({ onFiles, label, className, children }: UploadDropTargetProps) {
  const [isOver, setIsOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    setIsOver(false);
    if (!hasExternalFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    onFiles(readDroppedFiles(event));
  }

  return (
    <div
      onDragEnter={(event) => hasExternalFiles(event) && setIsOver(true)}
      onDragOver={(event) => {
        if (!hasExternalFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false);
      }}
      onDrop={handleDrop}
      className={cn("relative", className)}
    >
      {children}

      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute inset-3 z-overlay flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-accent-soft backdrop-blur-[1px]"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-pop">
              <CloudUpload className="size-7" strokeWidth={1.5} />
            </span>
            <p className="text-lead font-medium text-foreground">{label}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
