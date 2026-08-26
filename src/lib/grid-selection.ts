/** Selection maths for the grid. Coordinates are indexes into the current view. */

export interface CellAddress {
  readonly rowIndex: number;
  readonly columnIndex: number;
}

export interface GridBounds {
  readonly rowCount: number;
  readonly columnCount: number;
}

export interface GridRange {
  readonly anchor: CellAddress;
  readonly focus: CellAddress;
}

export interface RangeBox {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

export function rangeBox(range: GridRange): RangeBox {
  return {
    top: Math.min(range.anchor.rowIndex, range.focus.rowIndex),
    bottom: Math.max(range.anchor.rowIndex, range.focus.rowIndex),
    left: Math.min(range.anchor.columnIndex, range.focus.columnIndex),
    right: Math.max(range.anchor.columnIndex, range.focus.columnIndex),
  };
}

export function isInBox(box: RangeBox, rowIndex: number, columnIndex: number): boolean {
  return (
    rowIndex >= box.top &&
    rowIndex <= box.bottom &&
    columnIndex >= box.left &&
    columnIndex <= box.right
  );
}

export function boxSize(box: RangeBox): number {
  return (box.bottom - box.top + 1) * (box.right - box.left + 1);
}

export function isSingleCell(range: GridRange): boolean {
  return (
    range.anchor.rowIndex === range.focus.rowIndex &&
    range.anchor.columnIndex === range.focus.columnIndex
  );
}

export function clampAddress(address: CellAddress, bounds: GridBounds): CellAddress {
  return {
    rowIndex: Math.min(Math.max(address.rowIndex, 0), Math.max(0, bounds.rowCount - 1)),
    columnIndex: Math.min(Math.max(address.columnIndex, 0), Math.max(0, bounds.columnCount - 1)),
  };
}

export type MoveDirection = "up" | "down" | "left" | "right" | "rowStart" | "rowEnd" | "top" | "bottom";

const STEPS: Readonly<Record<MoveDirection, CellAddress>> = {
  up: { rowIndex: -1, columnIndex: 0 },
  down: { rowIndex: 1, columnIndex: 0 },
  left: { rowIndex: 0, columnIndex: -1 },
  right: { rowIndex: 0, columnIndex: 1 },
  rowStart: { rowIndex: 0, columnIndex: 0 },
  rowEnd: { rowIndex: 0, columnIndex: 0 },
  top: { rowIndex: 0, columnIndex: 0 },
  bottom: { rowIndex: 0, columnIndex: 0 },
};

export function moveAddress(
  address: CellAddress,
  direction: MoveDirection,
  bounds: GridBounds,
): CellAddress {
  switch (direction) {
    case "rowStart":
      return clampAddress({ ...address, columnIndex: 0 }, bounds);
    case "rowEnd":
      return clampAddress({ ...address, columnIndex: bounds.columnCount - 1 }, bounds);
    case "top":
      return clampAddress({ ...address, rowIndex: 0 }, bounds);
    case "bottom":
      return clampAddress({ ...address, rowIndex: bounds.rowCount - 1 }, bounds);
    default: {
      const step = STEPS[direction];
      return clampAddress(
        {
          rowIndex: address.rowIndex + step.rowIndex,
          columnIndex: address.columnIndex + step.columnIndex,
        },
        bounds,
      );
    }
  }
}

/** Tab wraps to the next row, the way a spreadsheet does. */
export function advanceAddress(address: CellAddress, bounds: GridBounds): CellAddress {
  if (address.columnIndex < bounds.columnCount - 1) {
    return { ...address, columnIndex: address.columnIndex + 1 };
  }
  if (address.rowIndex < bounds.rowCount - 1) {
    return { rowIndex: address.rowIndex + 1, columnIndex: 0 };
  }
  return address;
}

export function retreatAddress(address: CellAddress, bounds: GridBounds): CellAddress {
  if (address.columnIndex > 0) return { ...address, columnIndex: address.columnIndex - 1 };
  if (address.rowIndex > 0) {
    return { rowIndex: address.rowIndex - 1, columnIndex: Math.max(0, bounds.columnCount - 1) };
  }
  return address;
}

export function extendRange(
  range: GridRange,
  direction: MoveDirection,
  bounds: GridBounds,
): GridRange {
  return { anchor: range.anchor, focus: moveAddress(range.focus, direction, bounds) };
}

export function selectAll(bounds: GridBounds): GridRange {
  return {
    anchor: { rowIndex: 0, columnIndex: 0 },
    focus: {
      rowIndex: Math.max(0, bounds.rowCount - 1),
      columnIndex: Math.max(0, bounds.columnCount - 1),
    },
  };
}

export function singleRange(address: CellAddress): GridRange {
  return { anchor: address, focus: address };
}
