"use client";

import { useCallback, useEffect } from "react";
import { isWatchable, refKey } from "@/lib/entity-ref";
import { selectIsWatchPending, selectIsWatching, useWatchStore } from "@/store/watch-store";
import type { EntityRef } from "@/types";

export interface WatchController {
  /** False for targets with no activity stream — the button hides itself. */
  readonly isSupported: boolean;
  readonly isWatching: boolean;
  readonly isPending: boolean;
  readonly toggle: () => void;
}

/**
 * Follow state for one target (CO-WAT-28).
 *
 * Subscribes to a single boolean, so a watch toggle re-renders the button and
 * nothing else on the page.
 */
export function useWatch(ref: EntityRef | null): WatchController {
  const key = ref ? refKey(ref) : "";
  const isWatching = useWatchStore(selectIsWatching(key));
  const isPending = useWatchStore(selectIsWatchPending(key));
  const load = useWatchStore((state) => state.load);
  const toggleWatch = useWatchStore((state) => state.toggle);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(() => {
    if (ref) void toggleWatch(ref);
  }, [ref, toggleWatch]);

  return {
    isSupported: ref !== null && isWatchable(ref),
    isWatching,
    isPending,
    toggle,
  };
}
