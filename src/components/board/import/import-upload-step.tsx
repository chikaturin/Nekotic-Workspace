"use client";

import { CircleAlert, FileSpreadsheet } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IMPORT_MAX_ROWS } from "@/config/app";
import { hasExternalFiles, readDroppedFiles } from "@/lib/dnd";
import { cn } from "@/lib/utils";
import type { AppError } from "@/types";

interface ImportUploadStepProps {
  readonly error: AppError | null;
  readonly isBusy: boolean;
  readonly onFile: (file: File) => void;
}

const ACCEPT = ".xlsx,.csv,.tsv";

/** Step 1: hand over one spreadsheet. Nothing is written by picking a file. */
export function ImportUploadStep({ error, isBusy, onFile }: ImportUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    setIsOver(false);
    if (!hasExternalFiles(event)) return;

    event.preventDefault();
    const [file] = readDroppedFiles(event);
    if (file) onFile(file);
  }

  return (
    <div className="space-y-3 px-5 py-5">
      <div
        onDragEnter={(event) => hasExternalFiles(event) && setIsOver(true)}
        onDragOver={(event) => {
          if (!hasExternalFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors",
          isOver ? "border-accent bg-accent-soft" : "border-border bg-surface/60",
        )}
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            isOver ? "bg-accent text-accent-foreground" : "bg-hover text-muted-foreground",
          )}
        >
          {/* No `label` on the spinner: the line underneath already changes to
              "Reading the file…", and announcing the same fact twice is noise
              rather than access. */}
          {isBusy ? (
            <Spinner size="lg" />
          ) : (
            <FileSpreadsheet className="size-6" strokeWidth={1.5} />
          )}
        </span>

        <div>
          <p className="text-lead font-medium text-foreground">
            {isBusy ? "Reading the file…" : "Drop a spreadsheet here"}
          </p>
          <p className="metric mt-1 text-body text-faint-foreground">
            XLSX, CSV or TSV · up to {IMPORT_MAX_ROWS.toLocaleString("en-GB")} rows per import
          </p>
        </div>

        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-ui text-foreground">
          <CircleAlert className="mt-px size-3.5 shrink-0 text-danger" />
          <span>
            {error.message}
            {error.detail && (
              <span className="block text-body text-muted-foreground">{error.detail}</span>
            )}
          </span>
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
