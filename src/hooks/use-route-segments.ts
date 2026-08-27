"use client";

import { useMemo, useSyncExternalStore } from "react";
import { chainFromSearch, chainOf } from "@/lib/exported-routes";

/**
 * The slug chain the browser is currently asking for.
 *
 * Both address forms land here: the prerendered `/drive/a/b` path and the
 * `/drive/?p=a/b` fallback a node created after the build has to use. Reading
 * the live URL rather than the route params is what lets one prerendered page
 * serve every node without the whole route bailing out to client rendering.
 *
 * On the server there is no URL, so the params the route was built with are
 * used — the prerendered HTML is exactly what it always was.
 */

/** The URL never changes without one of these, so a no-op subscribe would lie. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

const serverSnapshot = (): string | null => null;

export function useRouteSegments(fallback: readonly string[]): readonly string[] {
  const url = useSyncExternalStore(
    subscribe,
    () => `${window.location.pathname}${window.location.search}`,
    serverSnapshot,
  );

  return useMemo(() => {
    if (url === null) return fallback;

    const [path = "", search = ""] = url.split("?");
    const queried = chainFromSearch(search);
    if (queried !== null) return queried;

    return chainOf(path)?.chain ?? fallback;
  }, [url, fallback]);
}
