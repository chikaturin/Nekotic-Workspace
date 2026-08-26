"use client";

import { Maximize2 } from "lucide-react";
import { memo } from "react";
import { GridCell } from "@/components/board/table/grid-cell";
import { GUTTER_WIDTH, type GridShared } from "@/components/board/table/grid-shared";
import { RowActionsMenu } from "@/components/board/table/row-actions-menu";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";

interface GridRowProps {
  readonly rowId: string;
  readonly rowIndex: number;
  readonly shared: GridShared;
}

/**
 * One record.
 *
 * The row subscribes to its own record, so editing a cell in row 12 re-renders
 * row 12 and leaves the other 4.999 untouched — that is the whole reason the
 * store is normalised.
 */
export const GridRow = memo(function GridRow({ rowId, rowIndex, shared }: GridRowProps) {
  const row = useBoardStore(selectRow(rowId));
  const isOpen = useGridStore((state) => state.drawerRowId === rowId);

  if (!row) return null;

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      style={{ height: shared.rowHeight }}
      className={cn(
        "group/row flex w-max",
        isOpen && "bg-accent-soft",
        shared.warnedRowIds.has(rowId) && "bg-warning/8",
      )}
    >
      <div
        style={{ width: GUTTER_WIDTH }}
        className={cn(
          "sticky left-0 z-20 flex shrink-0 items-center gap-0.5 border-b border-r border-hairline px-1",
          shared.warnedRowIds.has(rowId)
            ? "border-l-2 border-l-warning bg-warning/10"
            : "bg-surface",
        )}
      >
        <span
          className={cn(
            "metric w-6 shrink-0 text-right text-[10px] text-faint-foreground",
            "group-hover/row:hidden",
          )}
        >
          {rowIndex + 1}
        </span>

        <button
          type="button"
          aria-label={`Open ${row.displayId}`}
          onClick={() => useGridStore.getState().openDrawer(rowId)}
          className="hidden size-5 shrink-0 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-foreground group-hover/row:flex"
        >
          <Maximize2 className="size-3" />
        </button>

        <RowActionsMenu rowId={rowId} displayId={row.displayId} />
      </div>

      {shared.columns.map((column, columnIndex) => (
        <GridCell
          key={column.id}
          row={row}
          column={column}
          rowIndex={rowIndex}
          columnIndex={columnIndex}
          shared={shared}
        />
      ))}
    </div>
  );
});
