"use client";

import { FolderOpen, RotateCcw, Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { FilePreviewDialog } from "@/components/files/file-preview-dialog";
import { FileTable } from "@/components/files/file-table";
import { SimulationMenu } from "@/components/files/simulation-menu";
import { UploadDialog } from "@/components/files/upload-dialog";
import { UploadDropTarget } from "@/components/files/upload-drop-target";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { InlineSpinner, ListLoadingState, StatePanel } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import { useFileCatalog } from "@/hooks/use-file-catalog";
import { useFileDownload } from "@/hooks/use-file-preview";
import { formatCount } from "@/lib/format";
import { useUploadStore } from "@/store/upload-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { FileNode } from "@/types";

interface FileManagerProps {
  /** Folder whose files are managed; null is the workspace root. */
  readonly folderId: string | null;
  readonly title: string;
  readonly description?: string;
}

/**
 * File management surface: upload (drop or browse), listing with metadata,
 * preview, download — plus every async state the workspace can produce.
 */
export function FileManager({ folderId, title, description }: FileManagerProps) {
  const { state, isRefreshing, capabilities, reload } = useFileCatalog(folderId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isUploaderOpen, setUploaderOpen] = useState(false);

  const toggleFavorite = useWorkspaceStore((store) => store.toggleFavorite);
  const trashNode = useWorkspaceStore((store) => store.trashNode);
  const startUploads = useUploadStore((store) => store.startUploads);
  const download = useFileDownload();

  const files = useMemo<readonly FileNode[]>(
    () => (state.status === "success" ? state.data : []),
    [state],
  );

  const previewNode = useMemo(
    () => files.find((file) => file.id === previewId) ?? null,
    [files, previewId],
  );

  const handleDownload = useCallback((node: FileNode) => void download(node), [download]);

  /** Dropping files anywhere on the listing opens the full-page uploader. */
  const handleDroppedFiles = useCallback(
    (dropped: readonly File[]) => {
      setUploaderOpen(true);
      void startUploads(dropped, folderId);
    },
    [startUploads, folderId],
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="metric truncate text-[11px] text-faint-foreground">
            {description ?? formatCount(files.length, "file")}
          </p>
        </div>

        {isRefreshing && <InlineSpinner label="Refreshing" />}

        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" aria-label="Reload files" onClick={reload}>
            <RotateCcw />
          </Button>
          <SimulationMenu />
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => setUploaderOpen(true)}>
            <Upload />
            <span className="hidden sm:inline">Add files</span>
          </Button>
        </div>
      </header>

      <UploadDropTarget
        onFiles={handleDroppedFiles}
        label={`Drop to upload to ${title}`}
        className="min-h-0 flex-1"
      >
        <div className="canvas-grid h-full overflow-y-auto bg-canvas p-4">
          <AsyncBoundary
            state={state}
            onRetry={reload}
            loading={<ListLoadingState />}
            isEmpty={(data) => data.length === 0}
            empty={
              <StatePanel
                icon={FolderOpen}
                title="No files here yet"
                description="Drop files anywhere on this page, or use Add files to pick them from your computer."
              />
            }
          >
            {(data) => (
              <FileTable
                files={data}
                capabilities={capabilities}
                onPreview={setPreviewId}
                onDownload={handleDownload}
                onToggleFavorite={toggleFavorite}
                onTrash={trashNode}
              />
            )}
          </AsyncBoundary>
        </div>
      </UploadDropTarget>

      <UploadDialog
        open={isUploaderOpen}
        onOpenChange={setUploaderOpen}
        folderId={folderId}
        folderName={title}
        canUpload={capabilities.upload}
      />

      <FilePreviewDialog
        node={previewNode}
        siblings={files}
        onClose={() => setPreviewId(null)}
        onSelect={setPreviewId}
      />
    </div>
  );
}
