"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scrollOffsetFor, windowRange, type WindowRange } from "@/lib/grid-geometry";

interface VirtualRowsInput {
  readonly count: number;
  readonly rowHeight: number;
  readonly overscan?: number;
}

export interface VirtualRows {
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
  readonly range: WindowRange;
  readonly onScroll: () => void;
  readonly scrollToIndex: (index: number) => void;
}

const DEFAULT_OVERSCAN = 8;

/**
 * Fixed-height row virtualisation. Only the rows inside the viewport (plus an
 * overscan band) are mounted, so 5.000 records cost the same as 30.
 */
export function useVirtualRows({
  count,
  rowHeight,
  overscan = DEFAULT_OVERSCAN,
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

  const range = useMemo(
    () => windowRange({ scrollTop, viewportHeight, rowHeight, count, overscan }),
    [scrollTop, viewportHeight, rowHeight, count, overscan],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = scrollRef.current;
      if (!element) return;

      const offset = scrollOffsetFor(index, element.scrollTop, element.clientHeight, rowHeight);
      if (offset !== null) element.scrollTop = offset;
    },
    [rowHeight],
  );

  return { scrollRef, range, onScroll, scrollToIndex };
}
