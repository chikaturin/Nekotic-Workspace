"use client";

import { Download, X } from "lucide-react";
import { useMemo } from "react";
import { AttachmentSurface } from "@/components/board/attachments/attachment-surface";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { attachmentPreview, isReachable } from "@/lib/attachments";
import { formatBytes } from "@/lib/format";
import type { CellAttachment } from "@/types";

interface AttachmentViewerProps {
  /** Everything on the record — the viewer opens exactly one of them. */
  readonly files: readonly CellAttachment[];
  /** Attachment being viewed; null keeps the viewer closed. */
  readonly openId: string | null;
  readonly onOpenChange: (attachmentId: string | null) => void;
  readonly onDownload: (file: CellAttachment) => void;
}

/**
 * Opening an attachment.
 *
 * Clicking `payment-error.png` opens `payment-error.png` on the image canvas —
 * not a slideshow of everything else on the record. Anything else renders
 * through `AttachmentSurface`, which owns the per-type decisions.
 *
 * The full-resolution asset is what the viewer loads; thumbnails stay in the
 * cell and the drawer list, where they belong.
 */
export function AttachmentViewer({
  files,
  openId,
  onOpenChange,
  onDownload,
}: AttachmentViewerProps) {
  const current = useMemo(
    () => files.find((file) => file.id === openId) ?? null,
    [files, openId],
  );

  const strategy = current ? attachmentPreview(current) : "none";
  const isImage = current !== null && strategy === "image" && isReachable(current);

  if (isImage && current) {
    return (
      <ImageLightbox
        image={{
          url: current.url ?? "",
          alt: current.name,
          thumbnailUrl: current.thumbnailUrl,
        }}
        caption={formatBytes(current.sizeBytes)}
        onDownload={() => onDownload(current)}
        onClose={() => onOpenChange(null)}
      />
    );
  }

  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background p-0">
        {current && (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-lead font-medium text-foreground">
                  {current.name}
                </DialogTitle>
                <DialogDescription className="metric text-body text-faint-foreground">
                  {formatBytes(current.sizeBytes)} · {current.mimeType || "unknown type"}
                </DialogDescription>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onDownload(current)}
              >
                <Download />
                Download
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close attachment"
                onClick={() => onOpenChange(null)}
              >
                <X />
              </Button>
            </header>

            <div className="canvas-grid min-h-0 flex-1 overflow-auto bg-canvas">
              <AttachmentSurface
                key={current.id}
                file={current}
                strategy={strategy}
                onDownload={() => onDownload(current)}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
