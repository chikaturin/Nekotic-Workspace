"use client";

import { ImagePreview } from "@/components/files/preview/image-preview";
import { PdfPreview } from "@/components/files/preview/pdf-preview";
import { SheetPreview } from "@/components/files/preview/sheet-preview";
import { TextPreview } from "@/components/files/preview/text-preview";
import { UnsupportedPreview } from "@/components/files/preview/unsupported-preview";
import type { FileNode, FilePreview } from "@/types";

interface PreviewSurfaceProps {
  readonly preview: FilePreview;
  readonly node: FileNode;
  readonly onDownload: () => void;
  readonly canDownload: boolean;
  readonly canEdit: boolean;
  readonly onSaved: () => void;
}

export function PreviewSurface({
  preview,
  node,
  onDownload,
  canDownload,
  canEdit,
  onSaved,
}: PreviewSurfaceProps) {
  switch (preview.kind) {
    case "image":
      return <ImagePreview url={preview.url} alt={preview.alt} />;
    case "pdf":
      return <PdfPreview url={preview.url} fileName={node.name} onDownload={onDownload} />;
    case "sheet":
      return (
        <SheetPreview
          key={node.id}
          node={node}
          rows={preview.rows}
          sheetName={preview.sheetName}
          canEdit={canEdit}
          onSaved={onSaved}
        />
      );
    case "text":
      return (
        <TextPreview
          key={node.id}
          node={node}
          content={preview.content}
          language={preview.language}
          canEdit={canEdit}
          onSaved={onSaved}
        />
      );
    case "unsupported":
      return (
        <UnsupportedPreview
          node={node}
          reason={preview.reason}
          onDownload={onDownload}
          canDownload={canDownload}
        />
      );
  }
}
