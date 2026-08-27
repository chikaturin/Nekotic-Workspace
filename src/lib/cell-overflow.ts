/**
 * How many chips a table cell shows before it counts the rest.
 *
 * A grid column has a width the user chose, and a cell has exactly one line to
 * work with. A record linked to twenty others cannot show twenty chips: laying
 * them out honestly would either spill across the neighbouring column or push
 * the row taller than the fixed height the virtualiser is measuring with. Both
 * are worse than saying "and eleven more".
 *
 * The cut is a constant rather than a measurement. Measuring each cell would
 * mean a layout read per cell per frame on a grid built to mount five thousand
 * rows without one, and the answer would still be a number between two and
 * four. Three fits the narrowest column anyone resizes to and leaves the count
 * legible; `overflow-hidden` on the cell is what makes a wider chip harmless
 * rather than a spill.
 */

export const CELL_CHIP_LIMIT = 3;

export interface CellOverflow<T> {
  /** The items that get drawn. */
  readonly shown: readonly T[];
  /** How many were left out — zero when everything fits. */
  readonly overflow: number;
}

export function splitForCell<T>(
  items: readonly T[],
  limit: number = CELL_CHIP_LIMIT,
): CellOverflow<T> {
  const cap = Math.max(0, limit);

  // One over the cap is drawn rather than replaced by "+1", which would spend
  // the same width to say less.
  if (items.length <= cap + 1) return { shown: items, overflow: 0 };

  return { shown: items.slice(0, cap), overflow: items.length - cap };
}
