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
  readonly heights?: readonly number[] | null;
}

export interface VirtualRows {
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
  readonly range: WindowRange;
  readonly onScroll: () => void;
  readonly scrollToIndex: (index: number) => void;
}

const DEFAULT_OVERSCAN = 8;

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
