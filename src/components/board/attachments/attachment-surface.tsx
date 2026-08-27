"use client";

import { Download, FileWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { attachmentKind, isReachable } from "@/lib/attachments";
import { formatBytes } from "@/lib/format";
import { fileKindVisual } from "@/lib/node-visuals";
import type { PreviewStrategy } from "@/lib/preview-strategy";
import type { CellAttachment } from "@/types";

interface AttachmentSurfaceProps {
  readonly file: CellAttachment;
  readonly strategy: PreviewStrategy;
  readonly onDownload: () => void;
}

/**
 * One attachment, rendered by what it is.
 *
 * A dispatcher and nothing else: each strategy gets its own small renderer, so
 * adding a type never means growing a switch inside a viewer that also owns a
 * dialog, a header and a keyboard map. Images do not appear here — they open on
 * the canvas viewer instead.
 *
 * Nothing uploaded is ever rendered as markup: SVG and HTML are classed
 * unpreviewable in `lib/attachments`, so an uploaded file cannot execute in the
 * app's origin.
 */
export function AttachmentSurface({ file, strategy, onDownload }: AttachmentSurfaceProps) {
  if (!isReachable(file)) {
    return (
      <AttachmentFallback
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
          <AttachmentFallback
            file={file}
            reason="This browser cannot display PDFs inline."
            onDownload={onDownload}
          />
        </object>
      </div>
    );
  }

  if (strategy === "text" || strategy === "sheet") {
    return <AttachmentText file={file} onDownload={onDownload} />;
  }

  return (
    <AttachmentFallback
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
function AttachmentText({
  file,
  onDownload,
}: {
  readonly file: CellAttachment;
  readonly onDownload: () => void;
}) {
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
    return <AttachmentFallback file={file} reason={current.error} onDownload={onDownload} />;
  }

  return (
    <pre className="m-3 max-w-full overflow-auto rounded-lg border border-border bg-surface p-4 text-ui leading-relaxed text-foreground">
      <code>{current?.content ?? "Reading…"}</code>
    </pre>
  );
}

/** Metadata plus a download — what an unpreviewable file honestly offers. */
export function AttachmentFallback({
  file,
  reason,
  onDownload,
}: {
  readonly file: CellAttachment;
  readonly reason: string;
  readonly onDownload: () => void;
}) {
  const visual = fileKindVisual(attachmentKind(file));

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <visual.Icon className={`size-10 ${visual.colorClass}`} />
      <p className="text-lead text-foreground">{file.name}</p>
      <Badge variant="default">
        <FileWarning className="size-3" />
        {formatBytes(file.sizeBytes)}
      </Badge>
      <p className="max-w-sm text-ui text-muted-foreground">{reason}</p>
      <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
        <Download />
        Download
      </Button>
    </div>
  );
}
