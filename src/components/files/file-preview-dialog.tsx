"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PreviewSurface } from "@/components/files/preview/preview-surface";
import { ViewerDetails } from "@/components/files/preview/viewer-details";
import { ViewerHeader } from "@/components/files/preview/viewer-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useFilePreview } from "@/hooks/use-file-preview";
import { useHotkey } from "@/hooks/use-hotkey";
import { fileSummaryLine } from "@/lib/file-metadata";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types";

interface FilePreviewDialogProps {
  readonly node: FileNode | null;
  /** Files the ←/→ keys walk through. */
  readonly siblings: readonly FileNode[];
  readonly onClose: () => void;
  readonly onSelect: (nodeId: string) => void;
}

/**
 * Full-page file viewer: the file fills the screen, its details sit beside it,
 * and every file — previewable or not — offers metadata plus a download.
 */
export function FilePreviewDialog({ node, siblings, onClose, onSelect }: FilePreviewDialogProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const capabilities = useCapabilities(node);
  const { state, reload, download } = useFilePreview(node?.id ?? null);

  const index = useMemo(
    () => (node ? siblings.findIndex((candidate) => candidate.id === node.id) : -1),
    [node, siblings],
  );

  const step = useCallback(
    (delta: number) => {
      if (index < 0 || siblings.length === 0) return;
      const next = siblings[(index + delta + siblings.length) % siblings.length];
      if (next) onSelect(next.id);
    },
    [index, siblings, onSelect],
  );

  const isOpen = Boolean(node);

  useHotkey("arrowright", () => step(1), { enabled: isOpen });
  useHotkey("arrowleft", () => step(-1), { enabled: isOpen });
  useHotkey("i", () => setIsDetailsOpen((open) => !open), { enabled: isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background p-0">
        {node && (
          <>
            <ViewerHeader
              node={node}
              canEdit={capabilities.edit}
              canDownload={capabilities.view}
              isDetailsOpen={isDetailsOpen}
              onToggleDetails={() => setIsDetailsOpen((open) => !open)}
              onDownload={() => void download()}
              onClose={onClose}
            />

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <main className="canvas-grid relative min-h-0 flex-1 overflow-hidden bg-canvas">
                <AsyncBoundary
                  state={state}
                  onRetry={reload}
                  loading={
                    <div className="flex h-full items-center justify-center p-8">
                      <Skeleton className="h-full w-full max-w-4xl rounded-xl" />
                    </div>
                  }
                >
                  {(preview) => (
                    <PreviewSurface
                      preview={preview}
                      node={node}
                      onDownload={() => void download()}
                      canDownload={capabilities.view}
                      canEdit={capabilities.edit}
                      onSaved={reload}
                    />
                  )}
                </AsyncBoundary>

                {siblings.length > 1 && (
                  <>
                    <StepButton side="left" onClick={() => step(-1)} />
                    <StepButton side="right" onClick={() => step(1)} />
                  </>
                )}
              </main>

              {isDetailsOpen && <ViewerDetails node={node} />}
            </div>

            <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-surface px-4 py-2">
              <span className="metric truncate text-[11px] text-faint-foreground">
                {fileSummaryLine(node)}
              </span>

              <span className="ml-auto hidden items-center gap-2 text-[11px] text-faint-foreground sm:flex">
                <Kbd>I</Kbd> details
                <Kbd>Esc</Kbd> close
              </span>

              {siblings.length > 1 && (
                <span className="metric flex items-center gap-2 text-[11px] text-faint-foreground">
                  <Kbd>←</Kbd>
                  <Kbd>→</Kbd>
                  {index + 1} / {siblings.length}
                </span>
              )}
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
      aria-label={side === "left" ? "Previous file" : "Next file"}
      className={cn(
        "absolute top-1/2 z-10 size-9 -translate-y-1/2 rounded-full shadow-lg",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon />
    </Button>
  );
}
