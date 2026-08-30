"use client";

import { Download, X } from "lucide-react";
import { ImageCanvas } from "@/components/shared/image-canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface LightboxImage {
  readonly url: string;
  readonly alt: string;
  readonly thumbnailUrl?: string | null;
}

interface ImageLightboxProps {
  readonly image: LightboxImage | null;
  readonly onClose: () => void;
  readonly caption?: string;
  readonly onDownload?: () => void;
}

export function ImageLightbox({ image, onClose, caption, onDownload }: ImageLightboxProps) {
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background/98 p-0">
        {image && (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-lead font-medium text-foreground">
                  {image.alt || caption || "Image"}
                </DialogTitle>
                {caption && (
                  <DialogDescription className="truncate text-body text-faint-foreground">
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
