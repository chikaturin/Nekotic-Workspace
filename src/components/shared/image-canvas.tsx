"use client";

import { ImageOff, Maximize2, Minus, Plus, Scan } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/use-hotkey";
import { usePanZoom } from "@/hooks/use-pan-zoom";
import { scaleLabel } from "@/lib/pan-zoom";
import { cn } from "@/lib/utils";

interface ImageCanvasProps {
  /** Full-resolution asset. Thumbnails belong in cells and lists, not here. */
  readonly url: string;
  readonly alt: string;
  /** Optional low-resolution stand-in, shown blurred while the original loads. */
  readonly placeholderUrl?: string | null;
  readonly className?: string;
  /** Bind =/-/0 to zoom and fit. Off where another surface owns those keys. */
  readonly hasShortcuts?: boolean;
}

/**
 * A picture on a canvas, rather than a picture in a box.
 *
 * The image sits at its own size on an open surface: wheel or pinch to zoom
 * around the cursor, drag anywhere to pan, Fit and 100% to get back. It is the
 * interaction a map or a design tool uses, and it is the right one here for the
 * same reason — looking at a screenshot means moving around inside it, not
 * squinting at a version squeezed to fit the window.
 *
 * The transform is written straight to the DOM by `usePanZoom`, so dragging
 * never re-renders React. Nothing here is persisted: zoom and position are
 * where this reader happens to be looking, not a property of the file.
 */
export function ImageCanvas({
  url,
  alt,
  placeholderUrl,
  className,
  hasShortcuts = true,
}: ImageCanvasProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvas = usePanZoom({ viewportRef, stageRef });

  const isReady = status === "ready";
  // "=" rather than "+": the matcher compares the unshifted key.
  useHotkey("=", canvas.zoomIn, { enabled: hasShortcuts && isReady });
  useHotkey("-", canvas.zoomOut, { enabled: hasShortcuts && isReady });
  useHotkey("0", canvas.fit, { enabled: hasShortcuts && isReady });

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden bg-canvas", className)}>
      <div
        ref={viewportRef}
        {...canvas.handlers}
        onPointerCancel={canvas.handlers.onPointerUp}
        // `touch-none` hands touch gestures to the pointer handlers instead of
        // letting the browser scroll the dialog underneath.
        className={cn(
          "canvas-grid absolute inset-0 touch-none select-none",
          "cursor-grab [&.is-grabbing]:cursor-grabbing",
        )}
      >
        <div
          ref={stageRef}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL or signed asset URL, no loader involved */}
          <img
            src={url}
            alt={alt}
            // Without this the browser starts its own file drag and paints a
            // ghost image; a drag here means panning the canvas.
            draggable={false}
            onLoad={(event) => {
              const image = event.currentTarget;
              canvas.setContentSize({
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
              setStatus("ready");
            }}
            onError={() => setStatus("error")}
            className={cn(
              "block max-w-none rounded-lg border border-border bg-surface shadow-float",
              status === "ready" ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      </div>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
          {placeholderUrl ? (
            // The thumbnail is already in memory, so it stands in until the
            // original arrives — blurred, so nobody mistakes it for the file.
            // eslint-disable-next-line @next/next/no-img-element -- same asset pipeline as above
            <img
              src={placeholderUrl}
              alt=""
              aria-hidden
              className="max-h-full max-w-full rounded-lg opacity-60 blur-md"
            />
          ) : (
            <span className="metric text-body text-faint-foreground">Loading image…</span>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-10 text-center">
          <ImageOff className="size-8 text-faint-foreground" />
          <p className="text-ui text-muted-foreground">This image could not be loaded.</p>
        </div>
      )}

      {isReady && <CanvasToolbar canvas={canvas} />}
    </div>
  );
}

/**
 * Floating, small, and out of the way — the picture is the subject. Zoom out,
 * the current percentage, zoom in, then the two ways back: fit the frame, or
 * return to the pixels the file actually has.
 */
function CanvasToolbar({ canvas }: { canvas: ReturnType<typeof usePanZoom> }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-elevated/95 p-1 shadow-float backdrop-blur">
        <Button size="icon-sm" variant="ghost" aria-label="Zoom out" onClick={canvas.zoomOut}>
          <Minus />
        </Button>

        <span className="metric min-w-14 text-center text-body tabular-nums text-muted-foreground">
          {scaleLabel(canvas.scale)}
        </span>

        <Button size="icon-sm" variant="ghost" aria-label="Zoom in" onClick={canvas.zoomIn}>
          <Plus />
        </Button>

        <span className="mx-0.5 h-4 w-px bg-hairline" />

        <Button
          size="sm"
          variant={canvas.isFitted ? "subtle" : "ghost"}
          aria-pressed={canvas.isFitted}
          className="h-7 gap-1 px-2 text-body"
          title="Fit the whole image in view, centred"
          onClick={canvas.fit}
        >
          <Scan className="size-3.5" />
          Fit
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-body"
          title="Show the image at its actual pixel size"
          onClick={canvas.actualSize}
        >
          <Maximize2 className="size-3.5" />
          100%
        </Button>
      </div>
    </div>
  );
}
