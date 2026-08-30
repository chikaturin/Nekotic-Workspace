"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfPreviewProps {
  readonly url: string;
  readonly fileName: string;
  readonly onDownload: () => void;
}

export function PdfPreview({ url, fileName, onDownload }: PdfPreviewProps) {
  return (
    <div className="h-full w-full p-3">
      <object
        data={url}
        type="application/pdf"
        aria-label={`Preview of ${fileName}`}
        className="h-full min-h-[420px] w-full rounded-lg border border-border bg-surface"
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-lead text-foreground">This browser cannot display PDFs inline.</p>
          <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
            <Download />
            Download {fileName}
          </Button>
        </div>
      </object>
    </div>
  );
}
