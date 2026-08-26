"use client";

import { useEffect } from "react";
import { refKey } from "@/lib/entity-ref";
import { selectRecent, useRecentStore } from "@/store/recent-store";
import type { EntityRef, RecentEntry } from "@/types";

/** Read the recent list, hydrating it from local storage on first mount. */
export function useRecent(): {
  readonly entries: readonly RecentEntry[];
  readonly isHydrated: boolean;
  readonly remove: (key: string) => void;
  readonly clear: () => void;
} {
  const entries = useRecentStore(selectRecent);
  const isHydrated = useRecentStore((state) => state.isHydrated);
  const hydrate = useRecentStore((state) => state.hydrate);
  const remove = useRecentStore((state) => state.remove);
  const clear = useRecentStore((state) => state.clear);

  // Reading storage during render would disagree with the server markup, so
  // the list starts empty and fills in after mount.
  useEffect(() => hydrate(), [hydrate]);

  return { entries, isHydrated, remove, clear };
}

/**
 * Record a visit. Keyed on the target, so re-rendering a page does not push a
 * new entry — only actually arriving somewhere else does.
 */
export function useTrackRecent(ref: EntityRef | null): void {
  const visit = useRecentStore((state) => state.visit);
  const hydrate = useRecentStore((state) => state.hydrate);
  const key = ref ? refKey(ref) : null;
  const label = ref?.label ?? "";

  useEffect(() => {
    if (!ref || key === null) return;

    hydrate();
    visit(ref);
    // The ref object is rebuilt on every render; its key and label are what
    // actually identify the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, label, visit, hydrate]);
}
