"use client";

import { Download, X } from "lucide-react";
import { ImageCanvas } from "@/components/shared/image-canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** The minimum a viewer needs: where the bytes are and what to call them. */
export interface LightboxImage {
  readonly url: string;
  readonly alt: string;
  /** Low-resolution stand-in, if the caller has one already loaded. */
  readonly thumbnailUrl?: string | null;
}

interface ImageLightboxProps {
  /** The picture being viewed; null keeps the viewer closed. */
  readonly image: LightboxImage | null;
  readonly onClose: () => void;
  readonly caption?: string;
  /** Shown only when the caller can actually produce the file. */
  readonly onDownload?: () => void;
}

/**
 * Full-page image viewer.
 *
 * One picture, on a canvas — not a carousel. Opening `image2.png` shows
 * `image2.png`; there is no ←/→ to the ones beside it, because paging between
 * files was never what "look at this screenshot" meant, and it turned every
 * accidental arrow key into a different file. Choosing what to look at happens
 * where the files are listed.
 *
 * Everything about moving around inside the picture belongs to `ImageCanvas`.
 */
export function ImageLightbox({ image, onClose, caption, onDownload }: ImageLightboxProps) {
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background/98 p-0">
        {image && (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-[13px] font-medium text-foreground">
                  {image.alt || caption || "Image"}
                </DialogTitle>
                {caption && (
                  <DialogDescription className="truncate text-[11px] text-faint-foreground">
                    {caption}
                  </DialogDescription>
                )}
                {!caption && <DialogDescription className="sr-only">Image viewer</DialogDescription>}
              </div>

              {onDownload && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onDownload}>
                  <Download />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}

              <Button size="icon-sm" variant="ghost" aria-label="Close image" onClick={onClose}>
                <X />
              </Button>
            </header>

            <ImageCanvas
              // A new file starts a new canvas, so its zoom and position never
              // inherit the last picture's.
              key={image.url}
              url={image.url}
              alt={image.alt || "Image"}
              placeholderUrl={image.thumbnailUrl ?? null}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
