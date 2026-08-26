import { parseDelimited, toDelimited } from "@/lib/csv";
import { parseTextIntoCell } from "@/lib/cell-conversion";
import { cellOf, cellText, emptyCellFor, type CellContext } from "@/lib/cell-values";
import type { RowMap } from "@/lib/board-records";
import type { RangeBox } from "@/lib/grid-selection";
import type { BoardColumn, CellEdit } from "@/types";

/**
 * Excel-style copy and paste over a cell range.
 *
 * The wire format is TSV, which is what spreadsheets put on the clipboard, so
 * a range copied here pastes straight into Excel, Sheets or Numbers and back.
 */

export interface GridSlice {
  readonly rowIds: readonly string[];
  readonly columns: readonly BoardColumn[];
  readonly rowsById: RowMap;
  readonly context: CellContext;
}

const TAB = "\t";

export function copyRange(slice: GridSlice, box: RangeBox): string {
  const matrix: string[][] = [];

  for (let rowIndex = box.top; rowIndex <= box.bottom; rowIndex += 1) {
    const row = slice.rowsById[slice.rowIds[rowIndex] ?? ""];
    const cells: string[] = [];

    for (let columnIndex = box.left; columnIndex <= box.right; columnIndex += 1) {
      const column = slice.columns[columnIndex];
      cells.push(row && column ? cellText(cellOf(row, column), column, slice.context) : "");
    }

    matrix.push(cells);
  }

  return toDelimited(matrix, TAB);
}

export interface PasteResult {
  readonly edits: readonly CellEdit[];
  /** Cells the clipboard held that fell outside the grid. */
  readonly skipped: number;
  /** Values that could not be parsed and were kept as text with a warning. */
  readonly preserved: number;
}

/**
 * Write a clipboard payload into the grid starting at `anchor`. Values are
 * parsed into each target column's own type, so pasting a date column into a
 * select column behaves exactly like a column conversion would.
 */
export function pasteRange(slice: GridSlice, anchor: RangeBox, text: string): PasteResult {
  const matrix = parseDelimited(text, TAB);
  const edits: CellEdit[] = [];
  let skipped = 0;
  let preserved = 0;

  matrix.forEach((cells, rowOffset) => {
    const rowIndex = anchor.top + rowOffset;
    const rowId = slice.rowIds[rowIndex];

    cells.forEach((value, columnOffset) => {
      const column = slice.columns[anchor.left + columnOffset];

      if (!rowId || !column) {
        skipped += 1;
        return;
      }

      const parsed = parseTextIntoCell(value, column, slice.context);
      if (!parsed.ok) preserved += 1;

      edits.push({ rowId, columnId: column.id, value: parsed.value });
    });
  });

  return { edits, skipped, preserved };
}

/** Clearing a range writes the empty value for each column's type. */
export function clearRange(slice: GridSlice, box: RangeBox): readonly CellEdit[] {
  const edits: CellEdit[] = [];

  for (let rowIndex = box.top; rowIndex <= box.bottom; rowIndex += 1) {
    const rowId = slice.rowIds[rowIndex];
    if (!rowId) continue;

    for (let columnIndex = box.left; columnIndex <= box.right; columnIndex += 1) {
      const column = slice.columns[columnIndex];
      if (!column) continue;

      edits.push({ rowId, columnId: column.id, value: emptyCellFor(column.type) });
    }
  }

  return edits;
}
