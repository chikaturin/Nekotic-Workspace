"use client";

import { memo, useCallback, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { widthStyle, type GridShared } from "@/components/board/table/grid-shared";
import type { CellMove } from "@/lib/cell-arrow-exit";
import { cellOf } from "@/lib/cell-values";
import { GRID_FROZEN_ATTR, revealBeyondFrozen } from "@/lib/dom/grid-scroll";
import { moveAddress } from "@/lib/grid-selection";
import { cn } from "@/lib/utils";
import {
  selectIsEditing,
  selectIsFillOrigin,
  selectIsFillTarget,
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
  readonly isReadOnly: boolean;
  readonly indent?: number;
  readonly disclosure?: ReactNode;
}

function isReaderMarker(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-cell-detail]") != null;
}

function opensOnSingleClick(column: BoardColumn, value: CellValue): boolean {
  if (column.type === "date") return true;

  return (
    column.type === "attachment" && value.kind === "attachment" && value.attachments.length === 0
  );
}

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
  const isFillOrigin = useGridStore(selectIsFillOrigin(rowIndex, columnIndex));
  const isFillTarget = useGridStore(selectIsFillTarget(rowIndex, columnIndex));
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

  useLayoutEffect(() => {
    if (!isEditing) return;

    if (isReadOnly) {
      const grid = useGridStore.getState();
      grid.endEdit();
      grid.openDetail(row.id, column.id);
      return;
    }

    revealBeyondFrozen(element.current);
  }, [isEditing, isReadOnly, row.id, column.id]);

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isEditing || isReaderMarker(event.target)) return;
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

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isEditing) return;

      const target = event.target as Element | null;

      if (target?.closest?.("[data-cell-detail]") != null) {
        useGridStore.getState().openDetail(row.id, column.id);
        return;
      }

      if (isReadOnly) return;

      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;

      const isExpand = target?.closest?.("[data-cell-expand]") != null;
      if (!isExpand && !opensOnSingleClick(column, value)) return;

      const openId = target?.closest?.<HTMLElement>("[data-cell-focus-id]")?.dataset.cellFocusId;
      useGridStore.getState().beginEdit(row.id, column.id, openId ? { focusId: openId } : undefined);
    },
    [isReadOnly, isEditing, column, value, row.id],
  );

  /**
   * Trả con trỏ bàn phím về bảng sau khi thoát khỏi một ô.
   *
   * Ô đang sửa là một `<input>` thật; đóng nó lại là React gỡ luôn phần tử đang
   * giữ focus, và focus rơi về `<body>`. Bảng nghe phím trên chính div
   * `role="grid"` của nó, nên từ lúc đó mũi tên, Tab, Enter đều không còn tác
   * dụng — người dùng phải bấm chuột vào một ô mới gõ tiếp được.
   */
  const returnFocusToGrid = useCallback(() => {
    element.current?.closest<HTMLElement>('[role="grid"]')?.focus();
  }, []);

  const commit = useCallback(
    (next: CellValue, move: CellMove = "none") => {
      shared.onCommitCell(row.id, column.id, next);
      const grid = useGridStore.getState();
      grid.endEdit();

      // `move === "none"` nghĩa là ô đóng vì người dùng bấm sang chỗ khác. Kéo
      // focus về bảng lúc này là giật mất thứ họ vừa bấm vào.
      if (move === "none") return;

      grid.focusCell(moveAddress({ rowIndex, columnIndex }, move, shared.bounds));
      returnFocusToGrid();
    },
    [shared, row.id, column.id, rowIndex, columnIndex, returnFocusToGrid],
  );

  return (
    <div
      ref={element}
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      {...(column.isPrimary ? { [GRID_FROZEN_ATTR]: "" } : {})}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onDoubleClick={(event) => {
        if (isReadOnly || isEditing || isReaderMarker(event.target)) return;
        useGridStore.getState().beginEdit(row.id, column.id);
      }}
      style={widthStyle(column.id, column.isPrimary)}
      className={cn(
        "group/cell relative h-full shrink-0 border-b border-r border-hairline",
        column.isPrimary && "sticky z-sticky bg-surface",
        !column.isPrimary && isSelected && "bg-selection",
        isFillTarget &&
          "bg-accent-soft/50 outline-1 outline-dashed outline-accent/60 -outline-offset-1",
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

      {isFillOrigin && shared.onFillPointerDown && !isEditing && (
        <span
          className="absolute -bottom-[7px] -right-[7px] z-raised flex size-[14px] cursor-crosshair items-center justify-center"
          onPointerDown={shared.onFillPointerDown}
          data-fill-handle
          aria-hidden="true"
        >
          <span className="size-[7px] rounded-[1px] border border-surface bg-accent" />
        </span>
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
          canExitByArrow
          onCommit={commit}
          onCancel={() => {
            useGridStore.getState().endEdit();
            returnFocusToGrid();
          }}
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
            hasReader
          />
        </div>
      )}
    </div>
  );
});
