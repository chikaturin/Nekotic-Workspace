"use client";

import { Download } from "lucide-react";
import { FileMetadataTable } from "@/components/files/file-metadata-table";
import { Button } from "@/components/ui/button";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types";

interface UnsupportedPreviewProps {
  readonly node: FileNode;
  readonly reason: string;
  readonly onDownload: () => void;
  readonly canDownload: boolean;
}

/** Files with no inline renderer still show their full metadata and download. */
export function UnsupportedPreview({
  node,
  reason,
  onDownload,
  canDownload,
}: UnsupportedPreviewProps) {
  const { Icon, colorClass, tintClass, label } = nodeVisual(node);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className={cn("flex size-14 items-center justify-center rounded-xl", tintClass)}>
          <Icon className={cn("size-7", colorClass)} strokeWidth={1.5} />
        </span>
        <p className="text-lead font-medium text-foreground">{node.name}</p>
        <p className="max-w-sm text-lead text-muted-foreground">{reason}</p>
      </div>

      <FileMetadataTable node={node} className="w-full max-w-md" />

      <Button variant="default" size="sm" onClick={onDownload} disabled={!canDownload} className="gap-1.5">
        <Download />
        Download {label.toLowerCase()}
      </Button>
    </div>
  );
}
