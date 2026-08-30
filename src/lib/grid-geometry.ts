
export const ROW_HEIGHTS = { short: 32, medium: 44, tall: 68 } as const;

export type RowHeightKey = keyof typeof ROW_HEIGHTS;

export interface WindowInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight: number;
  readonly count: number;
  readonly overscan: number;
}

export interface WindowRange {
  readonly start: number;
  readonly end: number;
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly totalHeight: number;
}

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

export function prefixOffsets(heights: readonly number[]): readonly number[] {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;

  for (let index = 0; index < heights.length; index += 1) {
    offsets[index + 1] = (offsets[index] ?? 0) + (heights[index] ?? 0);
  }

  return offsets;
}

export function rowIndexAtOffset(
  offsets: readonly number[],
  position: number,
): number {
  return indexAt(offsets, position);
}

function indexAt(offsets: readonly number[], position: number): number {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if ((offsets[middle] ?? 0) <= position) low = middle;
    else high = middle - 1;
  }

  return low;
}

export interface VariableWindowInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly offsets: readonly number[];
  readonly overscan: number;
}

export function variableWindowRange({
  scrollTop,
  viewportHeight,
  offsets,
  overscan,
}: VariableWindowInput): WindowRange {
  const count = Math.max(0, offsets.length - 1);
  const totalHeight = offsets[count] ?? 0;

  if (count === 0) {
    return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0, totalHeight: 0 };
  }

  const top = Math.max(0, scrollTop);
  const first = indexAt(offsets, top);
  const last = indexAt(offsets, top + Math.max(0, viewportHeight));

  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + overscan + 1);

  return {
    start,
    end,
    paddingTop: offsets[start] ?? 0,
    paddingBottom: Math.max(0, totalHeight - (offsets[end] ?? totalHeight)),
    totalHeight,
  };
}

export function variableScrollOffsetFor(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  offsets: readonly number[],
): number | null {
  const top = offsets[index];
  const bottom = offsets[index + 1];
  if (top === undefined || bottom === undefined) return null;

  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return null;
}
