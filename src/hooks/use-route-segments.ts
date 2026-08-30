"use client";

import { useMemo, useSyncExternalStore } from "react";
import { locationSnapshot, subscribeToLocation } from "@/lib/dom/location";
import { chainFromSearch, chainOf } from "@/lib/exported-routes";

const serverSnapshot = (): string | null => null;

export function useRouteSegments(fallback: readonly string[]): readonly string[] {
  const url = useSyncExternalStore(subscribeToLocation, locationSnapshot, serverSnapshot);

  return useMemo(() => {
    if (url === null) return fallback;

    const [path = "", search = ""] = url.split("?");
    const queried = chainFromSearch(search);
    if (queried !== null) return queried;

    return chainOf(path)?.chain ?? fallback;
  }, [url, fallback]);
}
