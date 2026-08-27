"use client";

import { useState } from "react";
import { PreviewSurface } from "@/components/files/preview/preview-surface";
import { ViewerDetails } from "@/components/files/preview/viewer-details";
import { ViewerHeader } from "@/components/files/preview/viewer-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { useCapabilities } from "@/hooks/use-permissions";
import { useFilePreview } from "@/hooks/use-file-preview";
import { useHotkey } from "@/hooks/use-hotkey";
import { fileSummaryLine } from "@/lib/file-metadata";
import type { FileNode } from "@/types";

interface FilePreviewDialogProps {
  readonly node: FileNode | null;
  readonly onClose: () => void;
}

/**
 * Full-page file viewer: the file fills the screen, its details sit beside it,
 * and every file — previewable or not — offers metadata plus a download.
 *
 * It opens the file that was asked for and nothing else. There is no paging to
 * the file beside it: a spreadsheet is not a slide, and arrow keys that quietly
 * swap the document under the reader are a way to lose your place, not a way to
 * browse. Choosing a different file happens in the list that opened this one.
 */
export function FilePreviewDialog({ node, onClose }: FilePreviewDialogProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const capabilities = useCapabilities(node);
  const { state, reload, download } = useFilePreview(node?.id ?? null);

  const isOpen = Boolean(node);

  useHotkey("i", () => setIsDetailsOpen((open) => !open), { enabled: isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullscreen hideClose className="flex flex-col bg-background p-0">
        {node && (
          <>
            {/* The viewer draws its own chrome, but a dialog still has to be
                announceable: without a title it opens as an unnamed region. */}
            <DialogTitle className="sr-only">{node.name}</DialogTitle>
            <DialogDescription className="sr-only">
              File preview. Press I to toggle the details panel.
            </DialogDescription>

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
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
