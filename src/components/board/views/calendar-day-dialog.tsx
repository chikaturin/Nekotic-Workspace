"use client";

import { RecordCard } from "@/components/board/views/record-card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CellContext } from "@/lib/cell-values";
import { longDayLabel } from "@/lib/board-dates";
import { formatCount } from "@/lib/format";
import type { BoardColumn } from "@/types";

interface CalendarDayDialogProps {
  readonly day: { readonly iso: string; readonly rowIds: readonly string[] } | null;
  readonly primaryColumnId: string;
  readonly fields: readonly BoardColumn[];
  readonly context: CellContext;
  readonly canDrag: boolean;
  readonly onClose: () => void;
}

export function CalendarDayDialog({
  day,
  primaryColumnId,
  fields,
  context,
  canDrag,
  onClose,
}: CalendarDayDialogProps) {
  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80dvh] w-[26rem] max-w-[calc(100vw-2rem)] flex-col p-0">
        {day && (
          <>
            <header className="shrink-0 border-b border-border px-4 py-3 pr-12">
              <DialogTitle className="text-lead font-semibold text-foreground">
                {longDayLabel(day.iso)}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-ui text-muted-foreground">
                {formatCount(day.rowIds.length, "record")}
                <Badge variant="default">{day.rowIds.length}</Badge>
              </DialogDescription>
            </header>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
              {day.rowIds.map((rowId) => (
                <RecordCard
                  key={rowId}
                  rowId={rowId}
                  primaryColumnId={primaryColumnId}
                  fields={fields}
                  context={context}
                  canDrag={canDrag}
                />
              ))}

              {day.rowIds.length === 0 && (
                <p className="py-6 text-center text-ui text-faint-foreground">
                  Nothing scheduled on this day.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
