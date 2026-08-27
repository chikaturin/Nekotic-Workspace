"use client";

import { memo, useMemo } from "react";
import { GanttBar } from "@/components/board/gantt/gantt-bar";
import { longDayLabel } from "@/lib/board-dates";
import type { GanttRow } from "@/lib/board-gantt";
import { cellOf, cellText, type CellContext } from "@/lib/cell-values";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { BoardColumn, BoardColumnOf, SelectColor } from "@/types";

interface GanttLaneProps {
  readonly row: GanttRow;
  readonly primaryColumnId: string;
  /** Columns worth naming in the tooltip — the view's own visible ones. */
  readonly columns: readonly BoardColumn[];
  /** The select column the board designates as meaning "finished". */
  readonly statusColumn: BoardColumnOf<"select"> | null;
  readonly context: CellContext;
  readonly dayWidth: number;
  readonly height: number;
  readonly hasConflict: boolean;
}

/**
 * One record's lane on the chart.
 *
 * Like the task row beside it, it subscribes to its own record — so a date
 * edited in the table, the drawer or by dragging a different bar repaints one
 * lane rather than the whole chart.
 */
export const GanttLane = memo(function GanttLane({
  row,
  primaryColumnId,
  columns,
  statusColumn,
  context,
  dayWidth,
  height,
  hasConflict,
}: GanttLaneProps) {
  const record = useBoardStore(selectRow(row.rowId));
  const isOpen = useGridStore((state) => state.drawerRowId === row.rowId);

  const label = useMemo(() => {
    if (!record) return "";
    const value = record.cells[primaryColumnId];
    return value && value.kind === "text" ? value.value : "";
  }, [record, primaryColumnId]);

  /**
   * The bar takes the colour of the record's own Status option, so the chart
   * reads exactly like the board. No colour is decided here.
   */
  const color = useMemo<SelectColor | null>(() => {
    if (!record || !statusColumn) return null;

    const value = cellOf(record, statusColumn);
    if (value.kind !== "select") return null;

    const optionId = value.optionIds[0];
    return statusColumn.config.options.find((option) => option.id === optionId)?.color ?? null;
  }, [record, statusColumn]);

  const tooltip = useMemo(() => {
    if (!record || !row.schedule) return "";

    const lines = [`${record.displayId} ${label || "Untitled"}`];
    lines.push(`Start: ${longDayLabel(row.schedule.startIso)}`);
    lines.push(`End: ${longDayLabel(row.schedule.endIso)}`);

    lines.push(`Duration: ${row.schedule.span} day${row.schedule.span === 1 ? "" : "s"}`);
    if (row.isDerived) {
      lines.push("Summary of its subtasks — set the dates on the subtasks");
    }

    for (const column of columns) {
      if (column.type !== "select" && column.type !== "user") continue;
      const text = cellText(cellOf(record, column), column, context);
      if (text) lines.push(`${column.name}: ${text}`);
    }

    if (row.progress) {
      lines.push(`Progress: ${row.progress.completed}/${row.progress.total} subtasks · ${row.progress.percent}%`);
    }
    if (hasConflict) lines.push("⚠ Starts before something it is blocked by finishes");

    return lines.join("\n");
  }, [record, row, label, columns, context, hasConflict]);

  if (!record) return null;

  return (
    <div style={{ height }} className="relative border-b border-hairline">
      <GanttBar
        row={row}
        dayWidth={dayWidth}
        label={label || record.displayId}
        color={color}
        isOpen={isOpen}
        hasConflict={hasConflict}
        tooltip={tooltip}
        onOpen={() => useGridStore.getState().openDrawer(row.rowId)}
      />
    </div>
  );
});
