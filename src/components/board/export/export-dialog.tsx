"use client";

import { Download, FileSpreadsheet, FileText, LoaderCircle, ShieldOff, Table2 } from "lucide-react";
import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ExportController } from "@/hooks/use-board-export";
import { EXPORT_FORMAT_LABELS, EXPORT_SCOPE_LABELS } from "@/lib/board-export";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExportFormat, ExportScope } from "@/types";

interface ExportDialogProps {
  readonly isOpen: boolean;
  readonly controller: ExportController;
  /** Scope the dialog opens on — "selection" when it came from the bulk bar. */
  readonly initialScope?: ExportScope;
  readonly onClose: () => void;
}

const FORMAT_ICONS: Readonly<Record<ExportFormat, ComponentType<{ className?: string }>>> = {
  xlsx: FileSpreadsheet,
  csv: Table2,
  pdf: FileText,
};

const FORMAT_HINTS: Readonly<Record<ExportFormat, string>> = {
  xlsx: "One sheet, values as text — opens anywhere",
  csv: "UTF-8 with a byte-order mark, so Excel reads accents correctly",
  pdf: "A paginated list, for reading rather than re-importing",
};

const SCOPES: readonly ExportScope[] = ["board", "view", "selection"];
const FORMATS: readonly ExportFormat[] = ["xlsx", "csv", "pdf"];

/** Format · scope · what the file will and will not contain (SY-EXP-36). */
export function ExportDialog({
  isOpen,
  controller,
  initialScope = "board",
  onClose,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>(initialScope);

  const rowCount = controller.rowCounts[scope];
  const isEmpty = rowCount === 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        onClose();
      }}
    >
      <DialogContent className="max-w-lg p-0">
        <header className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="text-lead font-semibold text-foreground">Export records</DialogTitle>
          <DialogDescription className="mt-1 text-ui text-muted-foreground">
            Every format is written from the same values, so the three files always agree.
          </DialogDescription>
        </header>

        <div className="space-y-4 px-5 py-4">
          <fieldset>
            <legend className="mb-1.5 text-body font-semibold uppercase tracking-wider text-faint-foreground">
              Format
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((candidate) => {
                const Icon = FORMAT_ICONS[candidate];
                const isActive = candidate === format;

                return (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setFormat(candidate)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors",
                      isActive
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <Icon className={cn("size-4", isActive ? "text-accent" : "text-faint-foreground")} />
                    <span className="text-ui font-medium text-foreground">
                      {EXPORT_FORMAT_LABELS[candidate]}
                    </span>
                    <span className="text-micro leading-snug text-faint-foreground">
                      {FORMAT_HINTS[candidate]}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-body font-semibold uppercase tracking-wider text-faint-foreground">
              Scope
            </legend>
            <div className="space-y-1">
              {SCOPES.map((candidate) => {
                const count = controller.rowCounts[candidate];
                const isDisabled = count === 0;

                return (
                  <label
                    key={candidate}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                      scope === candidate
                        ? "border-accent bg-accent-soft"
                        : "border-border hover:bg-hover",
                      isDisabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="export-scope"
                      value={candidate}
                      checked={scope === candidate}
                      disabled={isDisabled}
                      onChange={() => setScope(candidate)}
                      className="size-3.5 accent-[var(--accent)]"
                    />
                    <span className="flex-1 text-ui text-foreground">
                      {EXPORT_SCOPE_LABELS[candidate]}
                    </span>
                    <span className="metric text-body text-faint-foreground">
                      {formatCount(count, "record")}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {controller.omittedColumns.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body leading-relaxed text-foreground">
              <ShieldOff className="mt-px size-3.5 shrink-0 text-warning" />
              <span>
                {controller.omittedColumns.join(", ")}{" "}
                {controller.omittedColumns.length === 1 ? "is" : "are"} left out — your role cannot
                read {controller.omittedColumns.length === 1 ? "that column" : "those columns"}.
              </span>
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="default"
            className="gap-1.5"
            disabled={isEmpty || controller.isExporting}
            onClick={() => {
              void controller.run(format, scope).then(onClose);
            }}
          >
            {controller.isExporting ? <LoaderCircle className="animate-spin" /> : <Download />}
            Export {formatCount(rowCount, "record")}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
