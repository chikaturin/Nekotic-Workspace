import { cellEquals, isCellEmpty } from "@/lib/cell-values";
import type { BoardRow, CellEdit, CellValue } from "@/types";

export type RowMap = Readonly<Record<string, BoardRow>>;

export interface RowIndex {
  readonly rowsById: RowMap;
  readonly rowOrder: readonly string[];
}

export function indexRows(rows: readonly BoardRow[]): RowIndex {
  const rowsById: Record<string, BoardRow> = {};
  const rowOrder: string[] = [];

  for (const row of rows) {
    rowsById[row.id] = row;
    rowOrder.push(row.id);
  }

  return { rowsById, rowOrder };
}

export function applyCellEdits(rows: RowMap, edits: readonly CellEdit[], at: string): RowMap {
  if (edits.length === 0) return rows;

  const next: Record<string, BoardRow> = { ...rows };
  let changed = false;

  for (const edit of edits) {
    const row = next[edit.rowId];
    if (!row) continue;
    if (cellEquals(row.cells[edit.columnId], edit.value)) continue;

    next[edit.rowId] = {
      ...row,
      cells: { ...row.cells, [edit.columnId]: edit.value },
      updatedAt: at,
    };
    changed = true;
  }

  return changed ? next : rows;
}

export interface CellRevert {
  readonly rowId: string;
  readonly columnId: string;
  readonly previous: CellValue | undefined;
  readonly expected: CellValue;
}

export function captureCells(rows: RowMap, edits: readonly CellEdit[]): readonly CellRevert[] {
  return edits.flatMap((edit) => {
    const row = rows[edit.rowId];
    if (!row) return [];

    return [
      {
        rowId: edit.rowId,
        columnId: edit.columnId,
        previous: row.cells[edit.columnId],
        expected: edit.value,
      },
    ];
  });
}

export function revertCellEdits(rows: RowMap, reverts: readonly CellRevert[]): RowMap {
  const next: Record<string, BoardRow> = { ...rows };
  let changed = false;

  for (const revert of reverts) {
    const row = next[revert.rowId];
    if (!row) continue;
    if (!cellEquals(row.cells[revert.columnId], revert.expected)) continue;

    const cells = { ...row.cells };
    if (revert.previous === undefined) {
      delete cells[revert.columnId];
    } else {
      cells[revert.columnId] = revert.previous;
    }

    next[revert.rowId] = { ...row, cells };
    changed = true;
  }

  return changed ? next : rows;
}

export function reconcileRows(rows: RowMap, serverRows: readonly BoardRow[]): RowMap {
  if (serverRows.length === 0) return rows;

  const next: Record<string, BoardRow> = { ...rows };
  for (const row of serverRows) next[row.id] = row;

  return next;
}

export function removeRowId(order: readonly string[], rowId: string): readonly string[] {
  const index = order.indexOf(rowId);
  return index < 0 ? order : [...order.slice(0, index), ...order.slice(index + 1)];
}

export function replaceRow(index: RowIndex, tempId: string, serverRow: BoardRow): RowIndex {
  const position = index.rowOrder.indexOf(tempId);
  if (position < 0) {
    return {
      rowsById: { ...index.rowsById, [serverRow.id]: serverRow },
      rowOrder: [...index.rowOrder, serverRow.id],
    };
  }

  const rowsById = { ...index.rowsById };
  delete rowsById[tempId];
  rowsById[serverRow.id] = serverRow;

  const rowOrder = [...index.rowOrder];
  rowOrder[position] = serverRow.id;

  return { rowsById, rowOrder };
}

export function removeRow(index: RowIndex, rowId: string): RowIndex {
  if (!index.rowsById[rowId]) return index;

  const rowsById = { ...index.rowsById };
  delete rowsById[rowId];

  return {
    rowsById: detachChildren(rowsById, [rowId]),
    rowOrder: removeRowId(index.rowOrder, rowId),
  };
}

export function detachChildren(rows: RowMap, removedIds: readonly string[]): RowMap {
  const removed = new Set(removedIds);
  if (removed.size === 0) return rows;

  const next: Record<string, BoardRow> = { ...rows };
  let changed = false;

  for (const [rowId, row] of Object.entries(rows)) {
    if (!row.parentRowId || !removed.has(row.parentRowId)) continue;
    next[rowId] = { ...row, parentRowId: null };
    changed = true;
  }

  return changed ? next : rows;
}

export function removeRows(index: RowIndex, rowIds: readonly string[]): RowIndex {
  const removed = new Set(rowIds.filter((rowId) => index.rowsById[rowId]));
  if (removed.size === 0) return index;

  const rowsById = { ...index.rowsById };
  for (const rowId of removed) delete rowsById[rowId];

  return {
    rowsById: detachChildren(rowsById, [...removed]),
    rowOrder: index.rowOrder.filter((rowId) => !removed.has(rowId)),
  };
}

export function copyCells(row: BoardRow): Readonly<Record<string, CellValue>> {
  return { ...row.cells };
}

export function countFilledCells(
  rows: RowMap,
  order: readonly string[],
  columnId: string,
): number {
  let filled = 0;

  for (const rowId of order) {
    const value = rows[rowId]?.cells[columnId];
    if (value && !isCellEmpty(value)) filled += 1;
  }

  return filled;
}
