"use client";

import { motion } from "framer-motion";
import { CloudUpload, Lock } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, ACCEPTED_HINT } from "@/lib/file-validation";
import { hasExternalFiles, readDroppedFiles } from "@/lib/dnd";
import { cn } from "@/lib/utils";
import { useUploadStore } from "@/store/upload-store";

interface FileDropzoneProps {
  /** Destination folder; null uploads to the workspace root. */
  readonly folderId: string | null;
  readonly canUpload: boolean;
  /** `hero` fills a full-page uploader; `card` sits inside a listing. */
  readonly tone?: "card" | "hero";
  readonly className?: string;
  /** Notified when files are handed over, so a host can react (open a panel). */
  readonly onFilesPicked?: () => void;
}

/**
 * Drag-and-drop plus click-to-browse upload surface. Validation and progress
 * live in the upload store — this only collects files and reflects state.
 */
export function FileDropzone({
  folderId,
  canUpload,
  tone = "card",
  className,
  onFilesPicked,
}: FileDropzoneProps) {
  const isHero = tone === "hero";
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const startUploads = useUploadStore((state) => state.startUploads);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    setIsOver(false);
    if (!canUpload || !hasExternalFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    onFilesPicked?.();
    void startUploads(readDroppedFiles(event), folderId);
  }

  if (!canUpload) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-surface/60 px-4 py-3",
          className,
        )}
      >
        <Lock className="size-4 shrink-0 text-faint-foreground" />
        <p className="text-lead text-muted-foreground">
          You do not have permission to upload to this folder.
        </p>
      </div>
    );
  }

  return (
    <div
      onDragEnter={(event) => hasExternalFiles(event) && setIsOver(true)}
      onDragOver={(event) => {
        if (!hasExternalFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-xl border border-dashed transition-colors",
        isHero ? "flex flex-col justify-center p-10" : "p-4",
        isOver ? "border-accent bg-accent-soft" : "border-border bg-surface/60 hover:border-border-strong",
        className,
      )}
    >
      <div className={cn("flex flex-col items-center text-center", isHero ? "gap-4" : "gap-2")}>
        <motion.span
          animate={isOver ? { y: [-2, -6, -2] } : { y: 0 }}
          transition={{ duration: 1.1, repeat: isOver ? Infinity : 0, ease: "easeInOut" }}
          className={cn(
            "flex items-center justify-center rounded-full",
            isHero ? "size-16" : "size-10",
            isOver ? "bg-accent text-accent-foreground" : "bg-hover text-muted-foreground",
          )}
        >
          <CloudUpload className={isHero ? "size-8" : "size-5"} strokeWidth={1.5} />
        </motion.span>

        <div>
          <p className={cn("font-medium text-foreground", isHero ? "text-title" : "text-lead")}>
            {isOver ? "Release to upload" : "Drop files here"}
          </p>
          <p className={cn("metric mt-1 text-faint-foreground", isHero ? "text-body" : "text-micro")}>
            {ACCEPTED_HINT}
          </p>
        </div>

        <Button
          variant={isHero ? "default" : "outline"}
          size={isHero ? "lg" : "sm"}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            onFilesPicked?.();
            void startUploads(files, folderId);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
