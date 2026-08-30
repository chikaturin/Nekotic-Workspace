"use client";

import { useCallback, useRef } from "react";

export function useBlockIds(prefix = "blk"): () => string {
  const counter = useRef(0);

  return useCallback(() => {
    counter.current += 1;
    return `${prefix}_${Date.now().toString(36)}_${counter.current.toString(36)}`;
  }, [prefix]);
}
