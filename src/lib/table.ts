import type { TableBlock } from "@/types";

const MIN_ROWS = 1;
const MIN_COLUMNS = 1;

export function columnCount(block: TableBlock): number {
  return block.rows[0]?.length ?? 0;
}

export function rowCount(block: TableBlock): number {
  return block.rows.length;
}

/** Pad every row to the widest one so the grid is always rectangular. */
export function normalizeTable(block: TableBlock): TableBlock {
  const width = Math.max(MIN_COLUMNS, ...block.rows.map((row) => row.length));
  const rows = block.rows.map((row) =>
    row.length === width ? row : [...row, ...Array.from({ length: width - row.length }, () => "")],
  );

  const padded = rows.length >= MIN_ROWS ? rows : [Array.from({ length: width }, () => "")];
  return { ...block, rows: padded };
}

export function setTableCell(
  block: TableBlock,
  rowIndex: number,
  columnIndex: number,
  value: string,
): TableBlock {
  const rows = block.rows.map((row, index) =>
    index === rowIndex ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell)) : row,
  );
  return { ...block, rows };
}

export function addTableRow(block: TableBlock, atIndex?: number): TableBlock {
  const width = Math.max(columnCount(block), MIN_COLUMNS);
  const newRow = Array.from({ length: width }, () => "");
  const position = atIndex ?? block.rows.length;

  return {
    ...block,
    rows: [...block.rows.slice(0, position), newRow, ...block.rows.slice(position)],
  };
}

export function removeTableRow(block: TableBlock, rowIndex: number): TableBlock {
  if (block.rows.length <= MIN_ROWS) return block;
  return { ...block, rows: block.rows.filter((_, index) => index !== rowIndex) };
}

export function addTableColumn(block: TableBlock, atIndex?: number): TableBlock {
  const position = atIndex ?? columnCount(block);
  return {
    ...block,
    rows: block.rows.map((row) => [...row.slice(0, position), "", ...row.slice(position)]),
  };
}

export function removeTableColumn(block: TableBlock, columnIndex: number): TableBlock {
  if (columnCount(block) <= MIN_COLUMNS) return block;
  return {
    ...block,
    rows: block.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
  };
}

export function toggleHeaderRow(block: TableBlock): TableBlock {
  return { ...block, hasHeaderRow: !block.hasHeaderRow };
}
