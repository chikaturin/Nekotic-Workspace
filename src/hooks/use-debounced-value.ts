"use client";

import { useEffect, useState } from "react";

/**
 * Trailing-edge debounce.
 *
 * Search reaches services that scan every board, so a keystroke must not start
 * a scan — only a pause does.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (Object.is(settled, value)) return;

    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, settled]);

  return settled;
}
