/** Pure geometry for the virtualised grid — no DOM, no React. */

export const ROW_HEIGHTS = { short: 32, medium: 44, tall: 68 } as const;

export type RowHeightKey = keyof typeof ROW_HEIGHTS;

export interface WindowInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight: number;
  readonly count: number;
  /** Extra rows rendered above and below the viewport. */
  readonly overscan: number;
}

export interface WindowRange {
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
  /** Pixels of spacer above the first rendered row. */
  readonly paddingTop: number;
  /** Pixels of spacer below the last rendered row. */
  readonly paddingBottom: number;
  readonly totalHeight: number;
}

/**
 * Which rows to mount for a scroll position. Rendering 5.000 rows costs the
 * same as rendering 30 because only the window is ever in the DOM.
 */
export function windowRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  count,
  overscan,
}: WindowInput): WindowRange {
  const totalHeight = count * rowHeight;

  if (count === 0 || rowHeight <= 0) {
    return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0, totalHeight: 0 };
  }

  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight);

  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan + 1);

  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: Math.max(0, (count - end) * rowHeight),
    totalHeight,
  };
}

/** Scroll offset that brings `index` fully into view, or null if it already is. */
export function scrollOffsetFor(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
): number | null {
  const top = index * rowHeight;
  const bottom = top + rowHeight;

  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return null;
}
