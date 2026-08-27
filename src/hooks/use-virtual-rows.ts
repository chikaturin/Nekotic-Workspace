"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  prefixOffsets,
  scrollOffsetFor,
  variableScrollOffsetFor,
  variableWindowRange,
  windowRange,
  type WindowRange,
} from "@/lib/grid-geometry";

interface VirtualRowsInput {
  readonly count: number;
  readonly rowHeight: number;
  readonly overscan?: number;
  /**
   * Per-row heights, when the view has a column that wraps or shows in full.
   * Omitted — the common case — the uniform arithmetic below is used unchanged,
   * so a board nobody has configured that way pays nothing for the feature.
   */
  readonly heights?: readonly number[] | null;
}

export interface VirtualRows {
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
  readonly range: WindowRange;
  readonly onScroll: () => void;
  readonly scrollToIndex: (index: number) => void;
}

const DEFAULT_OVERSCAN = 8;

/**
 * Row virtualisation. Only the rows inside the viewport (plus an overscan band)
 * are mounted, so 5.000 records cost the same as 30.
 *
 * Uniform by default and variable when `heights` is supplied — the second path
 * differs only in how a scroll position becomes an index, and it still never
 * measures a row: the heights arrive already computed from the text.
 */
export function useVirtualRows({
  count,
  rowHeight,
  overscan = DEFAULT_OVERSCAN,
  heights = null,
}: VirtualRowsInput): VirtualRows {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver !== "function") return;

    // The observer fires once on observe, which is the initial measurement.
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewportHeight(entry.contentRect.height);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) setScrollTop(element.scrollTop);
  }, []);

  // One pass over the list, and only when the heights themselves change.
  const offsets = useMemo(() => (heights ? prefixOffsets(heights) : null), [heights]);

  const range = useMemo(
    () =>
      offsets
        ? variableWindowRange({ scrollTop, viewportHeight, offsets, overscan })
        : windowRange({ scrollTop, viewportHeight, rowHeight, count, overscan }),
    [offsets, scrollTop, viewportHeight, rowHeight, count, overscan],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = scrollRef.current;
      if (!element) return;

      const offset = offsets
        ? variableScrollOffsetFor(index, element.scrollTop, element.clientHeight, offsets)
        : scrollOffsetFor(index, element.scrollTop, element.clientHeight, rowHeight);

      if (offset !== null) element.scrollTop = offset;
    },
    [offsets, rowHeight],
  );

  return { scrollRef, range, onScroll, scrollToIndex };
}
