"use client";

import { memo, useMemo } from "react";
import { GanttBar } from "@/components/board/gantt/gantt-bar";
import type { GanttDrag } from "@/hooks/use-gantt-drag";
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
  readonly startColumn: BoardColumn | null;
  readonly endColumn: BoardColumn | null;
  /** The select column the board designates as meaning "finished". */
  readonly statusColumn: BoardColumnOf<"select"> | null;
  readonly context: CellContext;
  readonly dayWidth: number;
  readonly height: number;
  readonly canEdit: boolean;
  readonly hasConflict: boolean;
  readonly drag: GanttDrag;
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
  startColumn,
  endColumn,
  statusColumn,
  context,
  dayWidth,
  height,
  canEdit,
  hasConflict,
  drag,
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

    if (row.isDerived) lines.push("Derived from subtasks — edit the subtasks' dates");
    if (row.isPartial) lines.push(`Only ${startColumn && endColumn ? "one date" : "one date column"} is set`);

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
  }, [record, row, label, columns, context, startColumn, endColumn, hasConflict]);

  if (!record) return null;

  return (
    <div style={{ height }} className="relative border-b border-hairline">
      <GanttBar
        row={row}
        dayWidth={dayWidth}
        label={label || record.displayId}
        color={color}
        canEdit={canEdit}
        isOpen={isOpen}
        hasConflict={hasConflict}
        tooltip={tooltip}
        drag={drag}
      />
    </div>
  );
});
