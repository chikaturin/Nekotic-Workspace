"use client";

import { Download, LoaderCircle, Paperclip, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { fileKindVisual, kindFromFileName } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/file-service";
import { useUploadStore } from "@/store/upload-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AttachmentBlock as AttachmentBlockModel } from "@/types";

interface AttachmentBlockProps {
  readonly block: AttachmentBlockModel;
  readonly onChange: (block: AttachmentBlockModel) => void;
  readonly isEditable: boolean;
  readonly folderId: string | null;
}

export function AttachmentBlock({ block, onChange, isEditable, folderId }: AttachmentBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadOne = useUploadStore((state) => state.uploadOne);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      // Tệp đính kèm của khối, không phải một mục trong Drive.
      const asset = await uploadOne(file, folderId, { kind: "block" });
      if (!asset) return;

      onChange({
        ...block,
        assetId: asset.id,
        name: asset.name,
        sizeBytes: asset.sizeBytes,
        mimeType: asset.mimeType,
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function download() {
    if (!block.assetId) {
      pushFeedback("This attachment has no stored file", "info");
      return;
    }

    let url: string;

    try {
      url = await fileService.getAssetUrl(block.assetId);
    } catch {
      pushFeedback("The file could not be reached", "error");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = block.name;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  if (!block.name) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface/60 px-4 py-3",
          !isEditable && "is-disabled",
        )}
      >
        <Paperclip className="size-4 shrink-0 text-faint-foreground" />
        <p className="flex-1 text-lead text-muted-foreground">No file attached</p>
        {isEditable && (
          <Button
            size="sm"
            variant="outline"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {isUploading ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {isUploading ? "Uploading…" : "Attach file"}
          </Button>
        )}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  const { Icon, colorClass, tintClass, label } = fileKindVisual(kindFromFileName(block.name));

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tintClass)}>
        <Icon className={cn("size-4", colorClass)} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-lead font-medium text-foreground">{block.name}</p>
        <p className="metric truncate text-micro text-faint-foreground">
          {label} · {formatBytes(block.sizeBytes)}
        </p>
      </div>

      <Button size="icon-sm" variant="ghost" aria-label={`Download ${block.name}`} onClick={download}>
        <Download />
      </Button>
    </div>
  );
}
