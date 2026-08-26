"use client";

import { create } from "zustand";
import { RECENT_LIMIT } from "@/config/app";
import { refKey } from "@/lib/entity-ref";
import { dropEntry, touchEntry } from "@/lib/lru";
import type { EntityRef, RecentEntry } from "@/types";

/**
 * Recent (CO-REC-33).
 *
 * A least-recently-used list of the last {@link RECENT_LIMIT} places visited,
 * kept in this browser only. It is a navigation convenience, so best-effort
 * storage is the right trade: a blocked storage API costs the history, nothing
 * else.
 */

const STORAGE_KEY = "nexdrop-recent";

interface RecentState {
  readonly entries: readonly RecentEntry[];
  /** False until local storage has been read, so SSR and hydration agree. */
  readonly isHydrated: boolean;
}

interface RecentActions {
  hydrate: () => void;
  visit: (ref: EntityRef) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export type RecentStore = RecentState & RecentActions;

const keyOf = (entry: RecentEntry) => refKey(entry.ref);

function read(): readonly RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Anything that does not look like an entry is dropped rather than trusted.
    return parsed.filter(isRecentEntry).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as { ref?: unknown; visitedAt?: unknown };
  if (typeof candidate.visitedAt !== "string") return false;
  if (typeof candidate.ref !== "object" || candidate.ref === null) return false;

  const ref = candidate.ref as { nodeId?: unknown; kind?: unknown; label?: unknown };
  return (
    typeof ref.nodeId === "string" &&
    typeof ref.kind === "string" &&
    typeof ref.label === "string"
  );
}

function write(entries: readonly RecentEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable — the list still works for this session */
  }
}

export const useRecentStore = create<RecentStore>()((set, get) => ({
  entries: [],
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return;
    set({ entries: read(), isHydrated: true });
  },

  visit: (ref) => {
    const entry: RecentEntry = { ref, visitedAt: new Date().toISOString() };
    const entries = touchEntry(get().entries, entry, keyOf, RECENT_LIMIT);

    set({ entries });
    write(entries);
  },

  remove: (key) => {
    const entries = dropEntry(get().entries, key, keyOf);
    if (entries === get().entries) return;

    set({ entries });
    write(entries);
  },

  clear: () => {
    set({ entries: [] });
    write([]);
  },
}));

export const selectRecent = (state: RecentStore): readonly RecentEntry[] => state.entries;
