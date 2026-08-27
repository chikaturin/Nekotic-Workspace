"use client";

import { CalendarPlus, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { GanttRow } from "@/lib/board-gantt";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";

interface GanttUnscheduledProps {
  readonly rows: readonly GanttRow[];
  readonly primaryColumnId: string;
}

/**
 * Records the chart cannot place.
 *
 * A task with no dates is the one most likely to need them, so it is listed
 * rather than dropped — a chart that quietly omits part of the board is a chart
 * that misrepresents it. Opening one goes to its drawer, where the dates are.
 *
 * Records whose start is after their end land here too, flagged: the chart will
 * not draw an impossible bar, and it will not silently reorder what someone
 * typed either.
 */
export function GanttUnscheduled({ rows, primaryColumnId }: GanttUnscheduledProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (rows.length === 0) return null;

  const invalid = rows.filter((row) => row.isInvalid).length;

  return (
    <section className="shrink-0 border-t border-border bg-background">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-hover"
      >
        {isOpen ? (
          <ChevronDown className="size-3 text-faint-foreground" />
        ) : (
          <ChevronRight className="size-3 text-faint-foreground" />
        )}
        <CalendarPlus className="size-3.5 text-faint-foreground" />
        <span className="text-[12px] text-foreground">Unscheduled</span>
        <Badge variant="default">{rows.length}</Badge>
        {invalid > 0 && (
          <Badge variant="danger">{invalid} with the start after the end</Badge>
        )}
      </button>

      {isOpen && (
        <ul className="max-h-40 overflow-y-auto border-t border-hairline px-2 py-1">
          {rows.map((row) => (
            <UnscheduledRow key={row.rowId} row={row} primaryColumnId={primaryColumnId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UnscheduledRow({
  row,
  primaryColumnId,
}: {
  readonly row: GanttRow;
  readonly primaryColumnId: string;
}) {
  const record = useBoardStore(selectRow(row.rowId));
  if (!record) return null;

  const title = record.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "";

  return (
    <li>
      <button
        type="button"
        onClick={() => useGridStore.getState().openDrawer(row.rowId)}
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-hover"
      >
        <span className="metric shrink-0 text-[10px] text-faint-foreground">
          {record.displayId}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
          {label || "Untitled"}
        </span>
        {row.isInvalid && (
          <span className="shrink-0 text-[10px] text-danger">start is after end</span>
        )}
      </button>
    </li>
  );
}
