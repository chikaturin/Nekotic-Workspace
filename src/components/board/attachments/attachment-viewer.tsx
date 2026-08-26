"use client";

import { Download, FileWarning, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { attachmentPreview, imagesAmong, isReachable } from "@/lib/attachments";
import { formatBytes } from "@/lib/format";
import { fileKindVisual } from "@/lib/node-visuals";
import { attachmentKind } from "@/lib/attachments";
import type { CellAttachment } from "@/types";

interface AttachmentViewerProps {
  /** Everything on the record, so the lightbox can page through the images. */
  readonly files: readonly CellAttachment[];
  /** Attachment being viewed; null keeps the viewer closed. */
  readonly openId: string | null;
  readonly onOpenChange: (attachmentId: string | null) => void;
  readonly onDownload: (file: CellAttachment) => void;
}

/**
 * Opening an attachment.
 *
 * Images go to the lightbox and page through the record's other images with
 * ←/→. PDFs and text render in place. Anything else shows its metadata and a
 * download, because a thumbnail opened in a new tab is not a preview.
 *
 * Nothing uploaded is ever rendered as markup: SVG and HTML are classed
 * unpreviewable in `lib/attachments`, so an uploaded file cannot execute in the
 * app's origin.
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

  const images = useMemo(() => imagesAmong(files), [files]);
  const strategy = current ? attachmentPreview(current) : "none";
  const isImage = current !== null && strategy === "image" && isReachable(current);

  const imageIndex = useMemo(() => {
    if (!isImage || !current) return null;
    const at = images.findIndex((file) => file.id === current.id);
    return at < 0 ? null : at;
  }, [isImage, current, images]);

  if (isImage && imageIndex !== null) {
    return (
      <ImageLightbox
        images={images.map((file) => ({ url: file.url ?? "", alt: file.name }))}
        index={imageIndex}
        onIndexChange={(next) => onOpenChange(images[next]?.id ?? null)}
        onClose={() => onOpenChange(null)}
        caption={`${images.length} image${images.length === 1 ? "" : "s"} on this record`}
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
                <DialogTitle className="truncate text-[13px] font-medium text-foreground">
                  {current.name}
                </DialogTitle>
                <DialogDescription className="metric text-[11px] text-faint-foreground">
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

interface SurfaceProps {
  readonly file: CellAttachment;
  readonly strategy: ReturnType<typeof attachmentPreview>;
  readonly onDownload: () => void;
}

function AttachmentSurface({ file, strategy, onDownload }: SurfaceProps) {
  if (!isReachable(file)) {
    return (
      <Fallback
        file={file}
        reason="The bytes for this attachment are not available in this session. Download it to open it."
        onDownload={onDownload}
      />
    );
  }

  if (strategy === "pdf") {
    return (
      <div className="h-full w-full p-3">
        <object
          data={file.url ?? ""}
          type="application/pdf"
          aria-label={`Preview of ${file.name}`}
          className="h-full min-h-[420px] w-full rounded-lg border border-border bg-surface"
        >
          <Fallback
            file={file}
            reason="This browser cannot display PDFs inline."
            onDownload={onDownload}
          />
        </object>
      </div>
    );
  }

  if (strategy === "text" || strategy === "sheet") {
    return <TextSurface file={file} onDownload={onDownload} />;
  }

  return (
    <Fallback
      file={file}
      reason={`${file.name.split(".").pop()?.toUpperCase() ?? "This"} files cannot be previewed in the browser.`}
      onDownload={onDownload}
    />
  );
}

/**
 * Text-like attachments are read as text and rendered as text — never as
 * markup. A `.json`, `.log` or `.csv` shows its own bytes, escaped by React.
 */
function TextSurface({ file, onDownload }: { file: CellAttachment; onDownload: () => void }) {
  /**
   * The result is stored with the URL it came from, so switching attachments
   * shows "Reading…" by derivation rather than by clearing state in an effect.
   * A late response for the previous file can never paint over the new one.
   */
  const [result, setResult] = useState<{
    url: string;
    content: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const url = file.url;
    if (!url) return;

    let isCurrent = true;

    fetch(url)
      .then((response) => response.text())
      .then((content) => {
        if (isCurrent) setResult({ url, content, error: null });
      })
      .catch(() => {
        if (isCurrent) setResult({ url, content: null, error: "Could not read this file." });
      });

    return () => {
      isCurrent = false;
    };
  }, [file.url]);

  const current = result?.url === file.url ? result : null;

  if (current?.error) {
    return <Fallback file={file} reason={current.error} onDownload={onDownload} />;
  }

  return (
    <pre className="m-3 max-w-full overflow-auto rounded-lg border border-border bg-surface p-4 text-[12px] leading-relaxed text-foreground">
      <code>{current?.content ?? "Reading…"}</code>
    </pre>
  );
}

function Fallback({
  file,
  reason,
  onDownload,
}: {
  file: CellAttachment;
  reason: string;
  onDownload: () => void;
}) {
  const visual = fileKindVisual(attachmentKind(file));

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <visual.Icon className={`size-10 ${visual.colorClass}`} />
      <p className="text-sm text-foreground">{file.name}</p>
      <Badge variant="default">
        <FileWarning className="size-3" />
        {formatBytes(file.sizeBytes)}
      </Badge>
      <p className="max-w-sm text-[12px] text-muted-foreground">{reason}</p>
      <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
        <Download />
        Download
      </Button>
    </div>
  );
}
