"use client";

import { useCallback, type KeyboardEvent } from "react";
import { isGridKeyTarget } from "@/lib/dom/typing-target";
import { advanceAddress, retreatAddress, selectAll, type GridBounds } from "@/lib/grid-selection";
import { useGridStore } from "@/store/grid-store";
import type { BoardColumn } from "@/types";

interface GridKeyboardInput {
  readonly bounds: GridBounds;
  readonly rowIds: readonly string[];
  readonly columns: readonly BoardColumn[];
  readonly onClearSelection: () => void;
  readonly onScrollToRow: (index: number) => void;
  /** Navigation stays live on a frozen board; only the write keys go quiet. */
  readonly isReadOnly?: boolean;
}

/** Types whose editor opens on a keystroke rather than needing a click. */
const TYPEAHEAD_TYPES = new Set<BoardColumn["type"]>(["text", "longText"]);

/**
 * Spreadsheet keyboard model: arrows move, Shift extends, Tab walks, Enter
 * edits, typing replaces, Delete clears, Space opens the record drawer.
 *
 * It is bound to the grid container, which also contains the column headers, so
 * the first thing it does is check the key was actually meant for it. A field
 * inside the grid — the header's rename input above all — keeps its own
 * keystrokes; see `dom/typing-target`.
 */
export function useGridKeyboard({
  bounds,
  rowIds,
  columns,
  onClearSelection,
  onScrollToRow,
  isReadOnly = false,
}: GridKeyboardInput) {
  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // A keystroke aimed at a field inside the grid is that field's, not the
      // cursor's — even one the grid itself rendered.
      if (!isGridKeyTarget(event.target)) return;

      const grid = useGridStore.getState();
      if (grid.editing) return;

      const focus = grid.range?.focus;
      if (!focus) return;

      const isMod = event.metaKey || event.ctrlKey;
      const rowId = rowIds[focus.rowIndex];
      const column = columns[focus.columnIndex];

      const move = (direction: Parameters<typeof grid.moveFocus>[0]) => {
        event.preventDefault();
        grid.moveFocus(direction, bounds, event.shiftKey);
      };

      switch (event.key) {
        case "ArrowUp":
          move(isMod ? "top" : "up");
          onScrollToRow(Math.max(0, focus.rowIndex - 1));
          return;
        case "ArrowDown":
          move(isMod ? "bottom" : "down");
          onScrollToRow(Math.min(bounds.rowCount - 1, focus.rowIndex + 1));
          return;
        case "ArrowLeft":
          move(isMod ? "rowStart" : "left");
          return;
        case "ArrowRight":
          move(isMod ? "rowEnd" : "right");
          return;
        case "Home":
          move(isMod ? "top" : "rowStart");
          return;
        case "End":
          move(isMod ? "bottom" : "rowEnd");
          return;

        case "Tab": {
          event.preventDefault();
          const next = event.shiftKey
            ? retreatAddress(focus, bounds)
            : advanceAddress(focus, bounds);
          grid.focusCell(next);
          onScrollToRow(next.rowIndex);
          return;
        }

        case "Enter": {
          event.preventDefault();
          // Asked unconditionally: the cell itself knows whether it can be
          // edited — the board may be writable while *this record* is archived
          // — and it answers a request it cannot honour by opening the reader.
          if (rowId && column) grid.beginEdit(rowId, column.id);
          return;
        }

        case " ": {
          if (!rowId) return;
          event.preventDefault();
          grid.openDrawer(rowId);
          return;
        }

        case "Escape":
          event.preventDefault();
          grid.setRange(null);
          return;

        case "Backspace":
        case "Delete":
          event.preventDefault();
          if (!isReadOnly) onClearSelection();
          return;

        default:
          break;
      }

      if (isMod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        grid.setRange(selectAll(bounds));
        return;
      }

      // Typing over a cell replaces it, the way a spreadsheet does.
      if (!isReadOnly && !isMod && !event.altKey && event.key.length === 1 && rowId && column) {
        if (!TYPEAHEAD_TYPES.has(column.type)) return;
        event.preventDefault();
        grid.beginEdit(rowId, column.id, { initialText: event.key });
      }
    },
    [bounds, rowIds, columns, onClearSelection, onScrollToRow, isReadOnly],
  );
}
