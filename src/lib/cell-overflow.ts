
export const CELL_CHIP_LIMIT = 3;

export interface CellOverflow<T> {
  readonly shown: readonly T[];
  readonly overflow: number;
}

export function splitForCell<T>(
  items: readonly T[],
  limit: number = CELL_CHIP_LIMIT,
): CellOverflow<T> {
  const cap = Math.max(0, limit);

  if (items.length <= cap + 1) return { shown: items, overflow: 0 };

  return { shown: items.slice(0, cap), overflow: items.length - cap };
}
