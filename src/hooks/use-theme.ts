"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "nexdrop-theme";

/**
 * The `<html>` class is the source of truth — it is set by the boot script
 * before hydration. Components subscribe to it as an external store, which
 * keeps the value correct on first paint without a state-syncing effect.
 */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode — the choice simply does not persist */
    }

    for (const listener of listeners) listener();
  }, []);

  return { theme, toggleTheme };
}
