"use client";

import { useCallback, type ClipboardEvent } from "react";
import { clearRange, copyRange, pasteRange, type GridSlice } from "@/lib/grid-clipboard";
import { rangeBox } from "@/lib/grid-selection";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Excel-style clipboard for the grid.
 *
 * These are the browser's own `copy`/`cut`/`paste` events rather than the async
 * Clipboard API: no permission prompt, and the payload is TSV, so a range
 * round-trips through a real spreadsheet.
 */
export function useGridClipboard(slice: GridSlice, isReadOnly = false) {
  const editCells = useBoardStore((state) => state.editCells);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const onCopy = useCallback(
    (event: ClipboardEvent) => {
      const range = useGridStore.getState().range;
      if (!range || useGridStore.getState().editing) return;

      event.preventDefault();
      event.clipboardData.setData("text/plain", copyRange(slice, rangeBox(range)));
    },
    [slice],
  );

  const onCut = useCallback(
    (event: ClipboardEvent) => {
      const range = useGridStore.getState().range;
      if (!range || useGridStore.getState().editing || isReadOnly) return;

      const box = rangeBox(range);
      event.preventDefault();
      event.clipboardData.setData("text/plain", copyRange(slice, box));
      void editCells(clearRange(slice, box));
    },
    [slice, editCells, isReadOnly],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent) => {
      const range = useGridStore.getState().range;
      if (!range || useGridStore.getState().editing || isReadOnly) return;

      const text = event.clipboardData.getData("text/plain");
      if (!text) return;

      event.preventDefault();
      const result = pasteRange(slice, rangeBox(range), text);
      if (result.edits.length === 0) return;

      void editCells(result.edits);

      if (result.preserved > 0) {
        pushFeedback(
          `${result.preserved} pasted ${result.preserved === 1 ? "value" : "values"} kept as text — the column could not parse them`,
          "info",
        );
      }
      if (result.skipped > 0) {
        pushFeedback(`${result.skipped} pasted cells fell outside the grid`, "info");
      }
    },
    [slice, editCells, pushFeedback, isReadOnly],
  );

  const clearSelection = useCallback(() => {
    const range = useGridStore.getState().range;
    if (!range) return;

    void editCells(clearRange(slice, rangeBox(range)));
  }, [slice, editCells]);

  return { onCopy, onCut, onPaste, clearSelection };
}
