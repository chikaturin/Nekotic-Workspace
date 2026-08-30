"use client";

import { Download, FileSpreadsheet, FileText, ShieldOff, Table2 } from "lucide-react";
import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import type { ExportController } from "@/hooks/use-board-export";
import { EXPORT_FORMAT_LABELS, EXPORT_SCOPE_LABELS } from "@/lib/board-export";
import { formatCount } from "@/lib/format";
import type { ExportFormat, ExportScope } from "@/types";

interface ExportDialogProps {
  readonly isOpen: boolean;
  readonly controller: ExportController;
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Export records</DialogTitle>
          <DialogDescription>
            Every format is written from the same values, so the three files always agree.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <RadioGroup
            label="Format"
            value={format}
            onValueChange={(value) => setFormat(value as ExportFormat)}
            listClassName="grid grid-cols-3 gap-2"
          >
            {FORMATS.map((candidate) => {
              const Icon = FORMAT_ICONS[candidate];

              return (
                <RadioCard
                  key={candidate}
                  layout="stack"
                  value={candidate}
                  icon={<Icon />}
                  label={EXPORT_FORMAT_LABELS[candidate]}
                  description={FORMAT_HINTS[candidate]}
                />
              );
            })}
          </RadioGroup>

          <RadioGroup
            label="Scope"
            value={scope}
            onValueChange={(value) => setScope(value as ExportScope)}
          >
            {SCOPES.map((candidate) => {
              const count = controller.rowCounts[candidate];

              return (
                <RadioCard
                  key={candidate}
                  value={candidate}
                  label={EXPORT_SCOPE_LABELS[candidate]}
                  disabled={count === 0}
                  meta={<span className="metric">{formatCount(count, "record")}</span>}
                />
              );
            })}
          </RadioGroup>

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
        </DialogBody>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="default"
            isLoading={controller.isExporting}
            disabled={isEmpty}
            onClick={() => {
              void controller.run(format, scope).then(onClose);
            }}
          >
            <Download />
            Export {formatCount(rowCount, "record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
