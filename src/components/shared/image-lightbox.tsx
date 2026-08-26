"use client";

import { ChevronLeft, ChevronRight, Maximize, Minimize, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useHotkey } from "@/hooks/use-hotkey";
import { cn } from "@/lib/utils";

/** The minimum a lightbox needs: where the bytes are and what to call them. */
export interface LightboxImage {
  readonly url: string;
  readonly alt: string;
}

interface ImageLightboxProps {
  readonly images: readonly LightboxImage[];
  /** Index being viewed; null keeps the lightbox closed. */
  readonly index: number | null;
  readonly onIndexChange: (index: number) => void;
  readonly onClose: () => void;
  readonly caption?: string;
}

/** Zoom steps, in multiples of the fitted size. 1 is "actual size". */
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
const MIN_ZOOM = ZOOM_STEPS[0];
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 4;
const FIT = "fit" as const;

type ZoomLevel = typeof FIT | number;

/**
 * Full-page image viewer — one click from any picture in a document or from
 * any image attached to a record.
 *
 * Fit is the default because it is the answer to "what am I looking at";
 * zooming is for "what does that pixel say". The image is re-fitted whenever
 * the picture changes, so paging through a set never leaves you scrolled into
 * the corner of the next one.
 */
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

  /**
   * Zoom is stored with the picture it belongs to, so moving to the next image
   * falls back to "fit" by derivation rather than by resetting state in an
   * effect. Paging never leaves you scrolled into the corner of the next one.
   */
  const [zoomFor, setZoomFor] = useState<{ index: number | null; zoom: ZoomLevel }>({
    index: null,
    zoom: FIT,
  });

  const zoom: ZoomLevel = zoomFor.index === index ? zoomFor.zoom : FIT;
  const setZoom = useCallback(
    (next: ZoomLevel | ((current: ZoomLevel) => ZoomLevel)) =>
      setZoomFor((current) => {
        const base = current.index === index ? current.zoom : FIT;
        return { index, zoom: typeof next === "function" ? next(base) : next };
      }),
    [index],
  );

  const step = useCallback(
    (delta: number) => {
      if (index === null || images.length === 0) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  const zoomBy = useCallback(
    (delta: number) => {
      setZoom((current) => {
        const base = current === FIT ? 1 : current;
        const at = ZOOM_STEPS.indexOf(base as (typeof ZOOM_STEPS)[number]);
        const from = at < 0 ? ZOOM_STEPS.indexOf(1) : at;
        const next = ZOOM_STEPS[Math.min(Math.max(from + delta, 0), ZOOM_STEPS.length - 1)];

        return next ?? 1;
      });
    },
    [setZoom],
  );

  useHotkey("arrowright", () => step(1), { enabled: isOpen });
  useHotkey("arrowleft", () => step(-1), { enabled: isOpen });
  // "=" rather than "+": the hotkey matcher compares the unshifted key.
  useHotkey("=", () => zoomBy(1), { enabled: isOpen });
  useHotkey("-", () => zoomBy(-1), { enabled: isOpen });
  useHotkey("0", () => setZoom(FIT), { enabled: isOpen });

  const isFitted = zoom === FIT;
  const scale = isFitted ? 1 : zoom;

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
                  {!isFitted && ` · ${Math.round(scale * 100)}%`}
                </DialogDescription>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Zoom out"
                  disabled={!isFitted && scale <= MIN_ZOOM}
                  onClick={() => zoomBy(-1)}
                >
                  <ZoomOut />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Zoom in"
                  disabled={!isFitted && scale >= MAX_ZOOM}
                  onClick={() => zoomBy(1)}
                >
                  <ZoomIn />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-pressed={isFitted}
                  aria-label="Fit to screen"
                  onClick={() => setZoom(FIT)}
                >
                  <Minimize />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-pressed={scale === 1 && !isFitted}
                  aria-label="Actual size"
                  onClick={() => setZoom(1)}
                >
                  <Maximize />
                </Button>
              </div>

              <Button size="icon-sm" variant="ghost" aria-label="Close image" onClick={onClose}>
                <X />
              </Button>
            </header>

            <div
              className="canvas-grid relative min-h-0 flex-1 overflow-auto bg-canvas"
              // Clicking the empty space around the picture closes the viewer;
              // clicking the picture itself must not, or zooming is unusable.
              onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
              }}
            >
              <div
                className={cn(
                  "flex min-h-full items-center justify-center p-6",
                  !isFitted && "w-max min-w-full",
                )}
                onClick={(event) => {
                  if (event.target === event.currentTarget) onClose();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the upload service */}
                <img
                  src={current.url}
                  alt={current.alt || "Image"}
                  onClick={() => (isFitted ? setZoom(1) : setZoom(FIT))}
                  style={isFitted ? undefined : { transform: `scale(${scale})`, transformOrigin: "center" }}
                  className={cn(
                    "rounded-lg border border-border bg-surface object-contain shadow-2xl",
                    isFitted
                      ? "max-h-full max-w-full cursor-zoom-in"
                      : "max-w-none cursor-zoom-out",
                  )}
                />
              </div>

              {images.length > 1 && (
                <>
                  <StepButton side="left" onClick={() => step(-1)} />
                  <StepButton side="right" onClick={() => step(1)} />
                </>
              )}
            </div>

            <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-surface px-4 py-2">
              {caption && (
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                  {caption}
                </span>
              )}
              <span className="ml-auto hidden items-center gap-2 text-[11px] text-faint-foreground sm:flex">
                <Kbd>=</Kbd>
                <Kbd>−</Kbd> zoom
                <Kbd>0</Kbd> fit
                <Kbd>Esc</Kbd> close
              </span>
            </footer>
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
