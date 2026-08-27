"use client";

import { Download, Paperclip, RotateCcw, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { AttachmentViewer } from "@/components/board/attachments/attachment-viewer";
import { CellOverflowCount } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AttachmentField } from "@/hooks/use-attachment-field";
import { attachmentKind, isImageAttachment, isReachable } from "@/lib/attachments";
import { CELL_CHIP_LIMIT, splitForCell } from "@/lib/cell-overflow";
import { hasExternalFiles, readDroppedFiles } from "@/lib/dnd";
import { triggerDownload } from "@/lib/dom/download";
import { formatBytes } from "@/lib/format";
import { fileKindVisual } from "@/lib/node-visuals";
import { isTaskActive } from "@/lib/upload-queue";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { CellAttachment } from "@/types";

interface AttachmentGalleryProps {
  readonly field: AttachmentField;
  readonly maxFiles: number;
  readonly canEdit: boolean;
  /** `compact` is the popover in the grid; `full` is the drawer section. */
  readonly density?: "compact" | "full";
  readonly label: string;
  /** Open straight onto this file's preview — a thumbnail in the cell was clicked. */
  readonly initialOpenId?: string | null;
}

/**
 * The attachment surface, used verbatim by the table cell and the drawer.
 *
 * Both are handed the same `AttachmentField`, which reads and writes the one
 * attachment cell on the board record — so a file dropped here appears there
 * on the next frame, with no second copy of the list to keep in step.
 */
export function AttachmentGallery({
  field,
  maxFiles,
  canEdit,
  density = "full",
  label,
  initialOpenId = null,
}: AttachmentGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const { files, uploads } = field;
  const failed = uploads.tasks.filter((task) => task.status === "error");
  const active = uploads.tasks.filter(isTaskActive);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    setIsOver(false);
    if (!hasExternalFiles(event) || !canEdit) return;

    event.preventDefault();
    event.stopPropagation();
    void field.upload(readDroppedFiles(event));
  }

  function download(file: CellAttachment) {
    if (!file.url) {
      pushFeedback(`“${file.name}” is not available in this session`, "error");
      return;
    }
    // The service hands out the URL for the stored asset — a signed one in
    // production. Nothing here builds a storage path of its own.
    triggerDownload(file.url, file.name);
  }

  return (
    <div
      onDragEnter={(event) => canEdit && hasExternalFiles(event) && setIsOver(true)}
      onDragOver={(event) => {
        if (!canEdit || !hasExternalFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={cn(
        "space-y-2 rounded-md transition-colors",
        density === "compact" ? "p-2" : "p-0",
        isOver && "bg-accent-soft ring-1 ring-accent",
      )}
    >
      {files.length > 0 && (
        <ul
          className={cn(
            "grid gap-1.5",
            density === "compact" ? "grid-cols-3" : "grid-cols-4 sm:grid-cols-5",
          )}
        >
          {files.map((file) => (
            <li key={file.id} className="group/file relative">
              <button
                type="button"
                onClick={() => setOpenId(file.id)}
                aria-label={`Open ${file.name}`}
                className="block w-full overflow-hidden rounded border border-border bg-surface outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Thumbnail file={file} />
              </button>

              <span className="mt-0.5 block truncate text-micro text-muted-foreground" title={file.name}>
                {file.name}
              </span>
              <span className="metric block truncate text-micro text-faint-foreground">
                {formatBytes(file.sizeBytes)}
              </span>

              <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover/file:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Download ${file.name}`}
                  onClick={() => download(file)}
                  className="flex size-5 items-center justify-center rounded-full border border-border bg-elevated"
                >
                  <Download className="size-2.5" />
                </button>

                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => field.remove(file.id)}
                    className="flex size-5 items-center justify-center rounded-full border border-border bg-elevated hover:border-danger hover:text-danger"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <div className="space-y-1">
          <Progress value={uploads.summary.progress} label={`Uploading to ${label}`} />
          <p className="metric text-micro text-faint-foreground">
            Uploading {active.length} file{active.length === 1 ? "" : "s"} ·{" "}
            {Math.round(uploads.summary.progress * 100)}%
          </p>
        </div>
      )}

      {failed.length > 0 && (
        <ul className="space-y-1">
          {failed.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-1.5 rounded border border-danger/30 bg-danger/5 px-1.5 py-1"
            >
              <span className="min-w-0 flex-1 truncate text-body text-foreground">
                {task.fileName}
              </span>
              <span className="hidden truncate text-micro text-danger sm:block">
                {task.error?.message ?? "Upload failed"}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Retry uploading ${task.fileName}`}
                onClick={() => field.retry(task.id)}
              >
                <RotateCcw />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Dismiss ${task.fileName}`}
                onClick={() => field.dismiss(task.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          disabled={!field.canAddMore}
          onClick={() => inputRef.current?.click()}
          className="h-7 w-full gap-1.5 text-body"
        >
          <Upload />
          {isOver ? "Drop to upload" : field.canAddMore ? "Add files" : `Limit of ${maxFiles} reached`}
        </Button>
      )}

      <p className="metric text-micro text-faint-foreground">
        {files.length} / {maxFiles} files
        {canEdit && " · drop files straight in"}
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) void field.upload(picked);
          event.target.value = "";
        }}
      />

      <AttachmentViewer
        files={files}
        openId={openId}
        onOpenChange={setOpenId}
        onDownload={download}
      />
    </div>
  );
}

function Thumbnail({ file }: { file: CellAttachment }) {
  if (isImageAttachment(file) && isReachable(file)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- session object URL, no loader involved
      <img
        src={file.thumbnailUrl ?? file.url ?? ""}
        alt={file.name}
        className="aspect-square w-full object-cover"
      />
    );
  }

  const visual = fileKindVisual(attachmentKind(file));

  return (
    <div
      className={cn(
        "flex aspect-square w-full flex-col items-center justify-center gap-1 p-1",
        visual.tintClass,
      )}
    >
      <visual.Icon className={cn("size-4", visual.colorClass)} />
      <span className="metric text-micro uppercase tracking-wide text-faint-foreground">
        {visual.label}
      </span>
    </div>
  );
}

/**
 * Compact read-only strip — what a table cell shows when it is not open.
 *
 * `isInteractive` marks each thumbnail as the thing a click in the grid should
 * open, carrying the file's own id so the editor lands on its preview. The
 * markers are inert data attributes rather than handlers: the strip is drawn
 * for every visible row, and giving each file a closure would put a callback
 * per attachment on a path built to stay cheap.
 */
export function AttachmentStrip({
  files,
  limit = CELL_CHIP_LIMIT,
  isInteractive = false,
}: {
  readonly files: readonly CellAttachment[];
  readonly limit?: number;
  readonly isInteractive?: boolean;
}) {
  const { shown, overflow } = splitForCell(files, limit);
  const marks = isInteractive
    ? (file: CellAttachment) => ({ "data-cell-expand": "", "data-cell-focus-id": file.id })
    : () => ({});

  return (
    <>
      {shown.map((file) =>
        isImageAttachment(file) && isReachable(file) ? (
          // eslint-disable-next-line @next/next/no-img-element -- session object URL
          <img
            key={file.id}
            {...marks(file)}
            src={file.thumbnailUrl ?? file.url ?? ""}
            alt={file.name}
            title={file.name}
            className="size-6 shrink-0 rounded border border-border object-cover"
          />
        ) : (
          <span
            key={file.id}
            {...marks(file)}
            title={file.name}
            className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-surface"
          >
            <Paperclip className="size-3 text-faint-foreground" />
          </span>
        ),
      )}
      {overflow > 0 && (
        <CellOverflowCount count={overflow} title={files.map((file) => file.name).join(", ")} />
      )}
    </>
  );
}
