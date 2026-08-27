"use client";

import { memo, useCallback, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { widthStyle, type GridShared } from "@/components/board/table/grid-shared";
import { cellOf } from "@/lib/cell-values";
import { GRID_FROZEN_ATTR, revealBeyondFrozen } from "@/lib/dom/grid-scroll";
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
  /** Frozen: an archived record, an archived board, or a viewer who may read. */
  readonly isReadOnly: boolean;
  /**
   * Hierarchy indent in pixels, applied to the primary cell only so a nested
   * row still lines up with every other column.
   */
  readonly indent?: number;
  /** Expand/collapse control for a record that owns subtasks. */
  readonly disclosure?: ReactNode;
}

/**
 * The one cell type a *single* click opens.
 *
 * Everything else in the grid opens on double-click, and that is right: a
 * single click is how you select, and a cell full of data has something to
 * select. An empty Attachment cell has nothing — there is no value to pick, no
 * text to range over, and the only thing anyone wants from it is the uploader.
 * Making them find the second click, or a menu, to reach the only action the
 * cell offers is a step that exists for the grid's convenience rather than
 * theirs.
 *
 * A cell that already holds files is *not* included: there, a click has to
 * reach the file, not the uploader.
 */
function opensOnSingleClick(column: BoardColumn, value: CellValue): boolean {
  return (
    column.type === "attachment" && value.kind === "attachment" && value.attachments.length === 0
  );
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
  isReadOnly,
  indent = 0,
  disclosure,
}: GridCellProps) {
  const isFocused = useGridStore(selectIsFocused(rowIndex, columnIndex));
  const isSelected = useGridStore(selectIsSelected(rowIndex, columnIndex));
  const isEditing = useGridStore(selectIsEditing(row.id, column.id));
  const initialText = useGridStore((state) =>
    state.editing?.rowId === row.id && state.editing.columnId === column.id
      ? state.editing.initialText
      : undefined,
  );
  const focusId = useGridStore((state) =>
    state.editing?.rowId === row.id && state.editing.columnId === column.id
      ? state.editing.focusId
      : undefined,
  );

  const value = cellOf(row, column);
  const element = useRef<HTMLDivElement>(null);

  /**
   * An editor must not open behind the frozen columns. Only ever runs for the
   * one cell that is being edited, and only when edit mode starts.
   */
  useLayoutEffect(() => {
    if (isEditing) revealBeyondFrozen(element.current);
  }, [isEditing]);

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

  /**
   * Single click, for the two things that are not selection.
   *
   * A `+4` marker means "there is more here than fits" — clicking it has to
   * show the rest, which is what the cell's own editor does. The other is the
   * empty Attachment cell above. Both are read off the DOM rather than passed
   * down as callbacks, because `CellRenderer` is memoised on the value and
   * handing it a fresh function per cell would undo that for five thousand
   * rows to serve two of them.
   */
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isReadOnly) return;

      const target = event.target as Element | null;
      const isExpand = target?.closest?.("[data-cell-expand]") != null;
      if (!isExpand && !opensOnSingleClick(column, value)) return;

      const openId = target?.closest?.<HTMLElement>("[data-cell-focus-id]")?.dataset.cellFocusId;
      useGridStore.getState().beginEdit(row.id, column.id, openId ? { focusId: openId } : undefined);
    },
    [isReadOnly, column, value, row.id],
  );

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
      ref={element}
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      // The frozen pane the rest of the row scrolls beneath. Marked in the DOM
      // because the only thing that needs it — keeping an editor out from
      // under it — measures the pane rather than recomputing its width.
      {...(column.isPrimary ? { [GRID_FROZEN_ATTR]: "" } : {})}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onDoubleClick={() => {
        if (!isReadOnly) useGridStore.getState().beginEdit(row.id, column.id);
      }}
      style={widthStyle(column.id, column.isPrimary)}
      className={cn(
        "group/cell relative h-full shrink-0 border-b border-r border-hairline",
        column.isPrimary && "sticky z-sticky bg-surface",
        !column.isPrimary && isSelected && "bg-selection",
        isFocused && "z-raised ring-2 ring-inset ring-accent",
      )}
    >
      {(indent > 0 || disclosure) && !isEditing && (
        <div
          style={{ width: indent + (disclosure ? 18 : 0) }}
          className="pointer-events-none absolute inset-y-0 left-0 z-overlay flex items-center justify-end pr-0.5"
        >
          <span className="pointer-events-auto">{disclosure}</span>
        </div>
      )}

      {isEditing && !isReadOnly ? (
        <CellEditor
          value={value}
          column={column}
          rowId={row.id}
          boardId={shared.boardId}
          primaryColumnId={shared.primaryColumnId}
          folderId={shared.folderId}
          people={shared.people}
          columns={shared.columns}
          context={shared.context}
          initialText={initialText}
          focusId={focusId}
          onCommit={commit}
          onCancel={() => useGridStore.getState().endEdit()}
          onCreateOption={(label) => shared.onCreateOption(column.id, label)}
        />
      ) : (
        <div
          style={indent > 0 || disclosure ? { paddingLeft: indent + (disclosure ? 18 : 0) } : undefined}
          className="h-full"
        >
          <CellRenderer
            value={value}
            column={column}
            context={shared.context}
            mode={shared.displayModes[column.id] ?? "compact"}
            isInteractive={!isReadOnly}
          />
        </div>
      )}
    </div>
  );
});
