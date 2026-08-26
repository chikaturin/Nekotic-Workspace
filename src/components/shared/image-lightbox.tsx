"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useHotkey } from "@/hooks/use-hotkey";
import { cn } from "@/lib/utils";
import type { DocumentImage } from "@/types";

interface ImageLightboxProps {
  readonly images: readonly DocumentImage[];
  /** Index being viewed; null keeps the lightbox closed. */
  readonly index: number | null;
  readonly onIndexChange: (index: number) => void;
  readonly onClose: () => void;
  readonly caption?: string;
}

/** Full-page image viewer — one click from any picture in a document. */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  caption,
}: ImageLightboxProps) {
  const current = index === null ? undefined : images[index];
  const isOpen = current !== undefined;
  const position = index ?? 0;

  function step(delta: number) {
    if (index === null || images.length === 0) return;
    onIndexChange((index + delta + images.length) % images.length);
  }

  useHotkey("arrowright", () => step(1), { enabled: isOpen });
  useHotkey("arrowleft", () => step(-1), { enabled: isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background/98 p-0">
        {current && (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-[13px] font-medium text-foreground">
                  {current.alt || caption || "Image"}
                </DialogTitle>
                <DialogDescription className="metric text-[11px] text-faint-foreground">
                  {position + 1} of {images.length}
                </DialogDescription>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Close image" onClick={onClose}>
                <X />
              </Button>
            </header>

            <div className="canvas-grid relative min-h-0 flex-1 overflow-auto bg-canvas">
              <div className="flex min-h-full items-center justify-center p-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the upload service */}
                <img
                  src={current.url}
                  alt={current.alt || "Document image"}
                  className="max-h-full max-w-full rounded-lg border border-border bg-surface object-contain shadow-2xl"
                />
              </div>

              {images.length > 1 && (
                <>
                  <StepButton side="left" onClick={() => step(-1)} />
                  <StepButton side="right" onClick={() => step(1)} />
                </>
              )}
            </div>

            {caption && (
              <footer className="shrink-0 border-t border-border bg-surface px-4 py-2 text-center text-[12px] text-muted-foreground">
                {caption}
              </footer>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 size-9 -translate-y-1/2 rounded-full shadow-lg",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon />
    </Button>
  );
}
