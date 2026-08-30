"use client";

import { Pencil } from "lucide-react";
import { useRef } from "react";
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
import { columnVisual } from "@/lib/board-visuals";
import { cellText, type CellContext } from "@/lib/cell-values";
import type { BoardColumn, CellValue } from "@/types";

interface CellDetailDialogProps {
  readonly column: BoardColumn | null;
  readonly value: CellValue | null;
  readonly context: CellContext;
  readonly recordLabel?: string;
  readonly onClose: () => void;
  readonly onEdit?: (() => void) | undefined;
}

export function CellDetailDialog({
  column,
  value,
  context,
  recordLabel,
  onClose,
  onEdit,
}: CellDetailDialogProps) {
  const isHandingOver = useRef(false);

  if (!column || !value) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const visual = columnVisual(column.type);
  const text = cellText(value, column, context);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="xl"
        className="flex max-h-[80dvh] flex-col"
        onCloseAutoFocus={(event) => {
          if (!isHandingOver.current) return;
          isHandingOver.current = false;
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <visual.Icon className="size-4 shrink-0 text-faint-foreground" />
            <span className="min-w-0 truncate">{column.name}</span>
          </DialogTitle>
          {recordLabel && (
            <DialogDescription className="truncate">{recordLabel}</DialogDescription>
          )}
        </DialogHeader>

        <DialogBody
          tabIndex={0}
          role="region"
          aria-label={`${column.name} in full`}
          className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {text.trim().length > 0 ? (
            <p className="whitespace-pre-wrap break-words text-lead leading-relaxed text-foreground">
              {text}
            </p>
          ) : (
            <p className="text-ui text-faint-foreground">This field is empty.</p>
          )}
        </DialogBody>

        <DialogFooter align="start">
          <span className="metric text-body text-faint-foreground">
            {countLines(text)} · {text.length.toLocaleString("en-GB")} characters
          </span>

          <span className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  isHandingOver.current = true;
                  onEdit();
                }}
              >
                <Pencil />
                Edit
              </Button>
            )}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function countLines(text: string): string {
  const lines = text.split("\n").length;
  return lines === 1 ? "1 line" : `${lines} lines`;
}
