"use client";

import { useCallback, useRef } from "react";

/** Monotonic block-id factory, stable for the lifetime of an editor instance. */
export function useBlockIds(prefix = "blk"): () => string {
  const counter = useRef(0);

  return useCallback(() => {
    counter.current += 1;
    return `${prefix}_${Date.now().toString(36)}_${counter.current.toString(36)}`;
  }, [prefix]);
}
