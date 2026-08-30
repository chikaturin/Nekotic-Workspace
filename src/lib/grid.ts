
export type Grid = readonly (readonly string[])[];

const MIN_ROWS = 1;
const MIN_COLUMNS = 1;

export function gridColumnCount(rows: Grid): number {
  return rows.reduce((widest, row) => Math.max(widest, row.length), 0);
}

export function normalizeGrid(rows: Grid): Grid {
  const width = Math.max(MIN_COLUMNS, gridColumnCount(rows));

  const padded = rows.map((row) =>
    row.length === width ? row : [...row, ...Array.from({ length: width - row.length }, () => "")],
  );

  return padded.length >= MIN_ROWS ? padded : [Array.from({ length: width }, () => "")];
}

export function setGridCell(rows: Grid, rowIndex: number, columnIndex: number, value: string): Grid {
  return rows.map((row, index) =>
    index === rowIndex ? row.map((cell, position) => (position === columnIndex ? value : cell)) : row,
  );
}

export function addGridRow(rows: Grid, atIndex?: number): Grid {
  const width = Math.max(MIN_COLUMNS, gridColumnCount(rows));
  const blank = Array.from({ length: width }, () => "");
  const position = atIndex ?? rows.length;

  return [...rows.slice(0, position), blank, ...rows.slice(position)];
}

export function removeGridRow(rows: Grid, rowIndex: number): Grid {
  if (rows.length <= MIN_ROWS) return rows;
  return rows.filter((_, index) => index !== rowIndex);
}

export function addGridColumn(rows: Grid, atIndex?: number): Grid {
  const position = atIndex ?? gridColumnCount(rows);
  return rows.map((row) => [...row.slice(0, position), "", ...row.slice(position)]);
}

export function removeGridColumn(rows: Grid, columnIndex: number): Grid {
  if (gridColumnCount(rows) <= MIN_COLUMNS) return rows;
  return rows.map((row) => row.filter((_, index) => index !== columnIndex));
}

export function columnLabel(index: number): string {
  let label = "";
  let remaining = index;

  while (remaining >= 0) {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  }

  return label;
}

export function trimGrid(rows: Grid): Grid {
  const isBlank = (values: readonly string[]) => values.every((cell) => cell.trim() === "");

  let lastRow = rows.length;
  while (lastRow > 1 && isBlank(rows[lastRow - 1] ?? [])) lastRow -= 1;

  const kept = rows.slice(0, lastRow);
  let lastColumn = gridColumnCount(kept);
  while (lastColumn > 1 && isBlank(kept.map((row) => row[lastColumn - 1] ?? ""))) lastColumn -= 1;

  return kept.map((row) => row.slice(0, lastColumn));
}
