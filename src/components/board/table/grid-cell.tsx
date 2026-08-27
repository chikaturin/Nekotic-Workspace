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

/** The reader marker owns its own click; the cell's gestures must let it past. */
function isReaderMarker(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-cell-detail]") != null;
}

/**
 * The cell types a *single* click opens.
 *
 * Most of the grid opens on double-click, and that is right: a single click is
 * how you select, and a cell full of text has something to select.
 *
 * Two types have nothing to select. An empty Attachment cell holds no value to
 * pick and no text to range over — the only thing anyone wants from it is the
 * uploader. A Date cell holds one atomic value that cannot be part-selected,
 * typed into or extended; every interaction with it is "open the calendar", so
 * making people find the second click is a step that exists for the grid's
 * convenience rather than theirs.
 *
 * A cell that already holds files is *not* included: there, a click has to
 * reach the file, not the uploader.
 */
function opensOnSingleClick(column: BoardColumn, value: CellValue): boolean {
  if (column.type === "date") return true;

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
   * What happens the moment a cell is asked to edit.
   *
   * A cell that cannot be edited — a viewer's board, or an archived record on
   * a board anybody else can write — answers with the reader instead of
   * nothing at all. That is the one place the substitution belongs: the
   * keyboard handler knows the board is frozen but not that this row is, and a
   * request that silently does nothing is how a clipped value becomes
   * unreadable to somebody working without a mouse.
   *
   * Otherwise the editor must not open behind the frozen columns. Both only
   * ever run for the one cell being edited, and only when edit mode starts.
   */
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
      // Pressing the reader marker must not begin a range: a few pixels of
      // travel would turn it into a drag and swallow the click entirely.
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
      // A click *inside* an open editor is the editor's. Without this, an
      // empty attachment cell — the one type that opens on a single click —
      // re-opened itself from every click in its own panel, so pressing Close
      // shut it and re-opened it in the same gesture.
      if (isEditing) return;

      const target = event.target as Element | null;

      // Reading comes first, and is not gated on permission: showing somebody
      // the whole of a value they can already see part of is not a write, and
      // a read-only board is exactly where a clipped step is hardest to read.
      if (target?.closest?.("[data-cell-detail]") != null) {
        useGridStore.getState().openDetail(row.id, column.id);
        return;
      }

      if (isReadOnly) return;

      // A modified click is a selection gesture — Shift extends the range,
      // Cmd/Ctrl is the platform's add-to-selection. Opening an editor on one
      // would take a cell type out of range selection altogether.
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;

      const isExpand = target?.closest?.("[data-cell-expand]") != null;
      if (!isExpand && !opensOnSingleClick(column, value)) return;

      const openId = target?.closest?.<HTMLElement>("[data-cell-focus-id]")?.dataset.cellFocusId;
      useGridStore.getState().beginEdit(row.id, column.id, openId ? { focusId: openId } : undefined);
    },
    [isReadOnly, isEditing, column, value, row.id],
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
      onDoubleClick={(event) => {
        // Two presses on the marker are two attempts to read, not a request to
        // edit — without this the pair opened the reader *and* an editor.
        if (isReadOnly || isEditing || isReaderMarker(event.target)) return;
        useGridStore.getState().beginEdit(row.id, column.id);
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
            hasReader
          />
        </div>
      )}
    </div>
  );
});
