"use client";

import { CalendarPlus, ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fillableRows, type GanttGap, type GanttRow } from "@/lib/board-gantt";
import { selectRow, useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import { useGridStore } from "@/store/grid-store";

const GAP_LABELS: Readonly<Record<GanttGap, string>> = {
  none: "no dates",
  partial: "needs both dates",
  inverted: "start is after end",
};

interface GanttUnscheduledProps {
  readonly rows: readonly GanttRow[];
  readonly primaryColumnId: string;
  readonly canEdit: boolean;
  readonly onFill: (rows: readonly GanttRow[]) => void;
}

export function GanttUnscheduled({
  rows,
  primaryColumnId,
  canEdit,
  onFill,
}: GanttUnscheduledProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (rows.length === 0) return null;

  const invalid = rows.filter((row) => row.gap === "inverted").length;
  const fillable = fillableRows(rows);

  return (
    <section className="shrink-0 border-t border-border bg-background">
      <div className="flex items-center gap-1.5 pr-2">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left hover:bg-hover"
        >
          {isOpen ? (
            <ChevronDown className="size-3 text-faint-foreground" />
          ) : (
            <ChevronRight className="size-3 text-faint-foreground" />
          )}
          <CalendarPlus className="size-3.5 text-faint-foreground" />
          <span className="text-ui text-foreground">Unscheduled</span>
          <Badge variant="default">{rows.length}</Badge>
          {invalid > 0 && <Badge variant="danger">{invalid} with the start after the end</Badge>}
        </button>

        {canEdit && fillable.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            title="Give every record here a start and an end, keeping any date it already has"
            onClick={() => onFill(fillable)}
          >
            <Wand2 />
            Fill {fillable.length} date{fillable.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      {isOpen && (
        <ul className="max-h-40 overflow-y-auto border-t border-hairline px-2 py-1">
          {rows.map((row) => (
            <UnscheduledRow
              key={row.rowId}
              row={row}
              primaryColumnId={primaryColumnId}
              canEdit={canEdit}
              onFill={() => onFill([row])}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function UnscheduledRow({
  row,
  primaryColumnId,
  canEdit,
  onFill,
}: {
  readonly row: GanttRow;
  readonly primaryColumnId: string;
  readonly canEdit: boolean;
  readonly onFill: () => void;
}) {
  const record = useBoardStore(selectRow(row.rowId));
  if (!record) return null;

  const title = record.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "";
  const canFill = canEdit && row.gap !== "inverted";

  return (
    <li className="flex items-center gap-1 pr-1">
      <button
        type="button"
        onClick={() => useGridStore.getState().openDrawer(row.rowId)}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-hover"
      >
        <span className="metric shrink-0 text-micro text-faint-foreground">
          {record.displayId}
        </span>
        <span className="min-w-0 flex-1 truncate text-ui text-foreground">
          {label || "Untitled"}
        </span>
        <span
          className={cn(
            "shrink-0 text-micro",
            row.gap === "inverted" ? "text-danger" : "text-faint-foreground",
          )}
        >
          {GAP_LABELS[row.gap ?? "none"]}
        </span>
      </button>

      {canFill && (
        <button
          type="button"
          title="Fill in the missing date"
          aria-label={`Fill in the missing date on ${record.displayId}`}
          onClick={onFill}
          className="shrink-0 rounded px-1.5 py-1 text-micro text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          Fill
        </button>
      )}
    </li>
  );
}
