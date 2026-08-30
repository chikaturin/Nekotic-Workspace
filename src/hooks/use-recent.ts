"use client";

import { useEffect } from "react";
import { refKey } from "@/lib/entity-ref";
import { selectRecent, useRecentStore } from "@/store/recent-store";
import type { EntityRef, RecentEntry } from "@/types";

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

  useEffect(() => hydrate(), [hydrate]);

  return { entries, isHydrated, remove, clear };
}

export function useTrackRecent(ref: EntityRef | null): void {
  const visit = useRecentStore((state) => state.visit);
  const hydrate = useRecentStore((state) => state.hydrate);
  const key = ref ? refKey(ref) : null;
  const label = ref?.label ?? "";

  useEffect(() => {
    if (!ref || key === null) return;

    hydrate();
    visit(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, label, visit, hydrate]);
}
