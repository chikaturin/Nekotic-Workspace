import { parseTextIntoCell } from "@/lib/cell-conversion";
import { cellOf, cellText } from "@/lib/cell-values";
import { detectFillPattern, projectFillValue } from "@/lib/fill-series";
import type { GridSlice } from "@/lib/grid-clipboard";
import type { RangeBox } from "@/lib/grid-selection";
import type { BoardColumn, CellEdit, CellValue, ColumnType } from "@/types";

const PROTECTED_TYPES: ReadonlySet<ColumnType> = new Set<ColumnType>([
  "attachment",
]);

const SERIES_TYPES: ReadonlySet<ColumnType> = new Set<ColumnType>([
  "text",
  "longText",
  "date",
]);

export type FillAxis = "vertical" | "horizontal";

export interface FillPlan {
  readonly edits: readonly CellEdit[];
  readonly preview: RangeBox;
  readonly blocked: number;
}

export function isFillable(column: BoardColumn): boolean {
  return !PROTECTED_TYPES.has(column.type);
}

export function fillTarget(
  source: RangeBox,
  pointer: { readonly rowIndex: number; readonly columnIndex: number },
): { readonly box: RangeBox; readonly axis: FillAxis } | null {
  const down = pointer.rowIndex - source.bottom;
  const right = pointer.columnIndex - source.right;

  if (down <= 0 && right <= 0) return null;

  if (down >= right) {
    return {
      axis: "vertical",
      box: { ...source, bottom: source.bottom + down },
    };
  }

  return {
    axis: "horizontal",
    box: { ...source, right: source.right + right },
  };
}

function sourceLines(
  slice: GridSlice,
  source: RangeBox,
  axis: FillAxis,
  lane: number,
): readonly string[] {
  const read = (rowIndex: number, columnIndex: number): string => {
    const row = slice.rowsById[slice.rowIds[rowIndex] ?? ""];
    const column = slice.columns[columnIndex];

    if (!row || !column) return "";

    return cellText(cellOf(row, column), column, slice.context);
  };

  if (axis === "vertical") {
    return Array.from({ length: source.bottom - source.top + 1 }, (_, index) =>
      read(source.top + index, lane),
    );
  }

  return Array.from({ length: source.right - source.left + 1 }, (_, index) =>
    read(lane, source.left + index),
  );
}

function sourceValues(
  slice: GridSlice,
  source: RangeBox,
  axis: FillAxis,
  lane: number,
): readonly (CellValue | undefined) [] {
  const read = (rowIndex: number, columnIndex: number): CellValue | undefined => {
    const row = slice.rowsById[slice.rowIds[rowIndex] ?? ""];
    const column = slice.columns[columnIndex];

    return row && column ? cellOf(row, column) : undefined;
  };

  if (axis === "vertical") {
    return Array.from({ length: source.bottom - source.top + 1 }, (_, index) =>
      read(source.top + index, lane),
    );
  }

  return Array.from({ length: source.right - source.left + 1 }, (_, index) =>
    read(lane, source.left + index),
  );
}

function valueFor(input: {
  readonly offset: number;
  readonly lines: readonly string[];
  readonly values: readonly (CellValue | undefined)[];
  readonly column: BoardColumn;
  readonly slice: GridSlice;
}): CellValue | null {
  const { offset, lines, values, column, slice } = input;
  const pattern = SERIES_TYPES.has(column.type)
    ? detectFillPattern(lines)
    : ({ kind: "copy" } as const);
  const projected = projectFillValue(pattern, offset);

  if (projected === null) {
    const source = values[(offset - 1) % values.length];

    return source ?? null;
  }

  const parsed = parseTextIntoCell(projected, column, slice.context);

  return parsed.ok ? parsed.value : null;
}

export function planFill(input: {
  readonly slice: GridSlice;
  readonly source: RangeBox;
  readonly pointer: { readonly rowIndex: number; readonly columnIndex: number };
}): FillPlan | null {
  const { slice, source, pointer } = input;
  const target = fillTarget(source, pointer);

  if (target === null) return null;

  const edits: CellEdit[] = [];
  let blocked = 0;

  if (target.axis === "vertical") {
    for (let columnIndex = source.left; columnIndex <= source.right; columnIndex += 1) {
      const column = slice.columns[columnIndex];

      if (!column) continue;

      if (!isFillable(column)) {
        blocked += target.box.bottom - source.bottom;
        continue;
      }

      const lines = sourceLines(slice, source, "vertical", columnIndex);
      const values = sourceValues(slice, source, "vertical", columnIndex);

      for (let rowIndex = source.bottom + 1; rowIndex <= target.box.bottom; rowIndex += 1) {
        const rowId = slice.rowIds[rowIndex];

        if (!rowId) continue;

        const value = valueFor({
          offset: rowIndex - source.bottom,
          lines,
          values,
          column,
          slice,
        });

        if (value === null) {
          blocked += 1;
          continue;
        }

        edits.push({ rowId, columnId: column.id, value });
      }
    }

    return { edits, preview: target.box, blocked };
  }

  for (let rowIndex = source.top; rowIndex <= source.bottom; rowIndex += 1) {
    const rowId = slice.rowIds[rowIndex];

    if (!rowId) continue;

    const lines = sourceLines(slice, source, "horizontal", rowIndex);
    const values = sourceValues(slice, source, "horizontal", rowIndex);
    const sourceColumn = slice.columns[source.right];

    for (
      let columnIndex = source.right + 1;
      columnIndex <= target.box.right;
      columnIndex += 1
    ) {
      const column = slice.columns[columnIndex];

      if (!column) continue;

      if (!isFillable(column) || column.type !== sourceColumn?.type) {
        blocked += 1;
        continue;
      }

      const value = valueFor({
        offset: columnIndex - source.right,
        lines,
        values,
        column,
        slice,
      });

      if (value === null) {
        blocked += 1;
        continue;
      }

      edits.push({ rowId, columnId: column.id, value });
    }
  }

  return { edits, preview: target.box, blocked };
}
