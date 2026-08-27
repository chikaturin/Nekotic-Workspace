"use client";

import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { memo } from "react";
import type { GanttRow } from "@/lib/board-gantt";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";

/** Indent per hierarchy level — the same step the table nests subtasks with. */
export const INDENT_PER_LEVEL = 14;

interface GanttTaskRowProps {
  readonly row: GanttRow;
  readonly primaryColumnId: string;
  readonly height: number;
  readonly onToggle: (rowId: string) => void;
}

/**
 * One line of the task panel.
 *
 * It subscribes to its own record, so renaming a task repaints one row rather
 * than the chart. Parents carry a disclosure triangle and their derived
 * progress; everything else is the record's id and title, because a task list
 * beside a chart earns its width by staying narrow.
 */
export const GanttTaskRow = memo(function GanttTaskRow({
  row,
  primaryColumnId,
  height,
  onToggle,
}: GanttTaskRowProps) {
  const record = useBoardStore(selectRow(row.rowId));
  const isOpen = useGridStore((state) => state.drawerRowId === row.rowId);

  if (!record) return null;

  const title = record.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "";

  return (
    <div
      style={{ height }}
      className={cn(
        "flex items-center border-b border-hairline pr-2",
        isOpen ? "bg-accent-soft" : "bg-background hover:bg-hover",
      )}
    >
      <span style={{ width: row.depth * INDENT_PER_LEVEL }} className="shrink-0" aria-hidden />

      {row.hasChildren ? (
        <button
          type="button"
          aria-expanded={!row.isCollapsed}
          aria-label={row.isCollapsed ? `Expand ${record.displayId}` : `Collapse ${record.displayId}`}
          onClick={() => onToggle(row.rowId)}
          className="flex size-5 shrink-0 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-foreground"
        >
          {row.isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}

      <button
        type="button"
        onClick={() => useGridStore.getState().openDrawer(row.rowId)}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <span className="metric shrink-0 text-[10px] text-faint-foreground">
          {record.displayId}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
          {label || "Untitled"}
        </span>

        {row.isInvalid && (
          <TriangleAlert
            className="size-3 shrink-0 text-danger"
            aria-label="Start date is after the end date"
          />
        )}

        {row.progress && (
          <span className="metric shrink-0 text-[10px] text-faint-foreground">
            {row.progress.percent}%
          </span>
        )}
      </button>
    </div>
  );
});
