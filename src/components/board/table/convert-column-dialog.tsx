"use client";

import { ArrowRight, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { COLUMN_TYPE_LABELS, makeColumn } from "@/lib/board-schema";
import { previewConversion } from "@/lib/cell-conversion";
import type { CellContext } from "@/lib/cell-values";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumn, BoardRow, ColumnType } from "@/types";

interface ConvertColumnDialogProps {
  readonly column: BoardColumn | null;
  readonly targetType: ColumnType | null;
  readonly rows: readonly BoardRow[];
  readonly context: CellContext;
  readonly onClose: () => void;
}

/**
 * Type conversion, previewed before it runs.
 *
 * Values the target type cannot parse are never dropped: they are kept as text
 * on the new value and flagged in the cell, which is the behaviour the PRD
 * calls for when Text becomes Date.
 */
export function ConvertColumnDialog({
  column,
  targetType,
  rows,
  context,
  onClose,
}: ConvertColumnDialogProps) {
  const convertColumn = useBoardStore((state) => state.convertColumn);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const [isConverting, setIsConverting] = useState(false);

  const preview = useMemo(() => {
    if (!column || !targetType) return null;

    const target = makeColumn(column.id, column.name, targetType, column.position);
    return previewConversion(rows, column, target, context);
  }, [column, targetType, rows, context]);

  async function run() {
    if (!column || !targetType) return;

    setIsConverting(true);
    try {
      const preserved = await convertColumn(column.id, targetType);
      pushFeedback(
        preserved > 0
          ? `Converted “${column.name}” — ${preserved} ${preserved === 1 ? "value" : "values"} kept as text with a warning`
          : `Converted “${column.name}” to ${COLUMN_TYPE_LABELS[targetType]}`,
        preserved > 0 ? "info" : "success",
      );
      onClose();
    } finally {
      setIsConverting(false);
    }
  }

  const isOpen = Boolean(column && targetType);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0">
        {column && targetType && preview && (
          <div className="p-4">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Change column type
            </DialogTitle>
            <DialogDescription className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="rounded border border-border px-1.5 py-0.5">
                {COLUMN_TYPE_LABELS[column.type]}
              </span>
              <ArrowRight className="size-3" />
              <span className="rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-accent">
                {COLUMN_TYPE_LABELS[targetType]}
              </span>
            </DialogDescription>

            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-hairline">
              <Stat label="Values" value={preview.total} />
              <Stat label="Convert" value={preview.converted} tone="success" />
              <Stat label="Kept as text" value={preview.preserved} tone="warning" />
            </dl>

            {preview.preserved > 0 && (
              <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
                  <TriangleAlert className="size-3.5" />
                  {preview.preserved} {preview.preserved === 1 ? "value" : "values"} cannot be parsed
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  They stay in the cell as text with a warning marker — nothing is deleted.
                </p>
                <ul className="metric mt-2 space-y-0.5 text-[11px] text-faint-foreground">
                  {preview.samples.map((sample, index) => (
                    <li key={index} className="truncate">
                      · {sample}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="default" disabled={isConverting} onClick={() => void run()}>
                {isConverting ? "Converting…" : "Convert column"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-faint-foreground">{label}</dt>
      <dd
        className={
          tone === "success"
            ? "metric text-[15px] text-success"
            : tone === "warning"
              ? "metric text-[15px] text-warning"
              : "metric text-[15px] text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
