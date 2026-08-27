"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

export type { Theme };
export { DEFAULT_THEME, THEME_STORAGE_KEY };

/**
 * The `<html>` class is the source of truth — the server renders it and the
 * boot script reconciles it with the stored choice before hydration.
 * Components subscribe to it as an external store, which keeps the value
 * correct on first paint without a state-syncing effect.
 *
 * Dark is the default: only an explicit choice of light turns it off.
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
  return DEFAULT_THEME;
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
