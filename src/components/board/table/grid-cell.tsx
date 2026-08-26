"use client";

import { memo, useCallback, type MouseEvent } from "react";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { widthStyle, type GridShared } from "@/components/board/table/grid-shared";
import { cellOf } from "@/lib/cell-values";
import { cn } from "@/lib/utils";
import {
  selectIsEditing,
  selectIsFocused,
  selectIsSelected,
  useGridStore,
} from "@/store/grid-store";
import type { BoardColumn, BoardRow, CellValue } from "@/types";

interface GridCellProps {
  readonly row: BoardRow;
  readonly column: BoardColumn;
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly shared: GridShared;
}

/**
 * One cell.
 *
 * It subscribes to three booleans out of the grid store rather than to the
 * selection object, so moving the cursor re-renders the two cells involved and
 * nothing else.
 */
export const GridCell = memo(function GridCell({
  row,
  column,
  rowIndex,
  columnIndex,
  shared,
}: GridCellProps) {
  const isFocused = useGridStore(selectIsFocused(rowIndex, columnIndex));
  const isSelected = useGridStore(selectIsSelected(rowIndex, columnIndex));
  const isEditing = useGridStore(selectIsEditing(row.id, column.id));
  const initialText = useGridStore((state) =>
    state.editing?.rowId === row.id && state.editing.columnId === column.id
      ? state.editing.initialText
      : undefined,
  );

  const value = cellOf(row, column);

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isEditing) return;
      const grid = useGridStore.getState();
      const address = { rowIndex, columnIndex };

      if (event.shiftKey && grid.range) {
        event.preventDefault();
        grid.setRange({ anchor: grid.range.anchor, focus: address });
        return;
      }

      grid.beginDragSelect(address);
    },
    [isEditing, rowIndex, columnIndex],
  );

  const handleMouseEnter = useCallback(() => {
    const grid = useGridStore.getState();
    if (grid.isDragSelecting) grid.dragSelectTo({ rowIndex, columnIndex });
  }, [rowIndex, columnIndex]);

  const commit = useCallback(
    (next: CellValue, move: "down" | "none" = "none") => {
      shared.onCommitCell(row.id, column.id, next);
      const grid = useGridStore.getState();
      grid.endEdit();

      if (move === "down") {
        grid.focusCell({ rowIndex: rowIndex + 1, columnIndex });
      }
    },
    [shared, row.id, column.id, rowIndex, columnIndex],
  );

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onDoubleClick={() => useGridStore.getState().beginEdit(row.id, column.id)}
      style={widthStyle(column.id, column.isPrimary)}
      className={cn(
        "relative h-full shrink-0 border-b border-r border-hairline",
        column.isPrimary && "sticky z-20 bg-surface",
        !column.isPrimary && isSelected && "bg-selection",
        isFocused && "z-30 ring-2 ring-inset ring-accent",
      )}
    >
      {isEditing ? (
        <CellEditor
          value={value}
          column={column}
          rowId={row.id}
          boardId={shared.boardId}
          primaryColumnId={shared.primaryColumnId}
          folderId={shared.folderId}
          people={shared.people}
          initialText={initialText}
          onCommit={commit}
          onCancel={() => useGridStore.getState().endEdit()}
          onCreateOption={(label) => shared.onCreateOption(column.id, label)}
        />
      ) : (
        <CellRenderer value={value} column={column} context={shared.context} />
      )}
    </div>
  );
});
