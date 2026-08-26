"use client";

import { Paperclip, Upload, X } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { CellShell, EditorSurface } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploads } from "@/hooks/use-uploads";
import { hasExternalFiles, readDroppedFiles } from "@/lib/dnd";
import { formatBytes } from "@/lib/format";
import { fileService } from "@/services/file-service";
import { useUploadStore } from "@/store/upload-store";
import { cn } from "@/lib/utils";
import type { BoardColumnOf, CellAttachment, CellValue } from "@/types";

type AttachmentValue = Extract<CellValue, { kind: "attachment" }>;

const THUMBNAIL_LIMIT = 3;

function isImage(file: CellAttachment): boolean {
  return file.mimeType.startsWith("image/");
}

export function AttachmentCellView({ value }: { value: AttachmentValue }) {
  const shown = value.attachments.slice(0, THUMBNAIL_LIMIT);
  const overflow = value.attachments.length - shown.length;

  return (
    <CellShell>
      {shown.map((file) =>
        isImage(file) && file.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- session object URL
          <img
            key={file.id}
            src={file.thumbnailUrl}
            alt={file.name}
            className="size-6 shrink-0 rounded border border-border object-cover"
          />
        ) : (
          <span
            key={file.id}
            title={file.name}
            className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-surface"
          >
            <Paperclip className="size-3 text-faint-foreground" />
          </span>
        ),
      )}
      {overflow > 0 && (
        <span className="metric text-[10px] text-faint-foreground">+{overflow}</span>
      )}
    </CellShell>
  );
}

interface AttachmentEditorProps {
  readonly value: AttachmentValue;
  readonly column: BoardColumnOf<"attachment">;
  readonly rowId: string;
  readonly folderId: string | null;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

/**
 * Dropping several images at once is the QA evidence flow from the PRD: files
 * upload in parallel through the shared upload store, with progress scoped to
 * this cell by tag, and thumbnails appear as each one lands.
 */
export function AttachmentCellEditor({
  value,
  column,
  rowId,
  folderId,
  onCommit,
  onCancel,
}: AttachmentEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<readonly CellAttachment[]>(value.attachments);
  const [isOver, setIsOver] = useState(false);
  const startUploads = useUploadStore((state) => state.startUploads);

  const tag = `cell:${rowId}:${column.id}`;
  const { tasks, summary, hasActive } = useUploads(tag);

  const addFiles = useCallback(
    async (picked: readonly File[]) => {
      if (picked.length === 0) return;

      const room = Math.max(0, column.config.maxFiles - files.length);
      const assets = await startUploads(picked.slice(0, room), folderId, {
        tag,
        openPanel: false,
      });

      const added: readonly CellAttachment[] = assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        url: fileService.getAssetUrl(asset.id),
        thumbnailUrl: asset.kind === "image" ? fileService.getAssetUrl(asset.id) : null,
      }));

      if (added.length > 0) setFiles((current) => [...current, ...added]);
    },
    [column.config.maxFiles, files.length, startUploads, folderId, tag],
  );

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    setIsOver(false);
    if (!hasExternalFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    void addFiles(readDroppedFiles(event));
  }

  return (
    <EditorSurface className="w-72">
      <div
        onDragEnter={(event) => hasExternalFiles(event) && setIsOver(true)}
        onDragOver={(event) => {
          if (!hasExternalFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn("p-2", isOver && "bg-accent-soft")}
      >
        {files.length > 0 && (
          <ul className="mb-2 grid grid-cols-3 gap-1.5">
            {files.map((file) => (
              <li key={file.id} className="group relative">
                {isImage(file) && file.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- session object URL
                  <img
                    src={file.thumbnailUrl}
                    alt={file.name}
                    className="aspect-square w-full rounded border border-border object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded border border-border bg-surface p-1 text-center">
                    <Paperclip className="size-3.5 text-faint-foreground" />
                    <span className="line-clamp-2 text-[9px] text-muted-foreground">{file.name}</span>
                  </div>
                )}

                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                  className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full border border-border bg-elevated group-hover:flex"
                >
                  <X className="size-2.5" />
                </button>

                <span className="metric mt-0.5 block truncate text-[9px] text-faint-foreground">
                  {formatBytes(file.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {hasActive && (
          <div className="mb-2 space-y-1">
            <Progress value={summary.progress} className="h-1" />
            <p className="metric text-[10px] text-faint-foreground">
              Uploading {summary.active} of {tasks.length}
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={files.length >= column.config.maxFiles}
            onClick={() => inputRef.current?.click()}
            className="h-7 flex-1 gap-1.5 text-[11px]"
          >
            <Upload />
            {isOver ? "Drop to upload" : "Add files"}
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => onCommit({ kind: "attachment", attachments: files })}
            className="h-7 px-2 text-[11px]"
          >
            Done
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 px-2 text-[11px]">
            Cancel
          </Button>
        </div>

        <p className="metric mt-1 text-[10px] text-faint-foreground">
          {files.length} / {column.config.maxFiles} files · drop images straight in
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) void addFiles(picked);
          event.target.value = "";
        }}
      />
    </EditorSurface>
  );
}
