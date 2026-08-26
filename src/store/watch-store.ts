"use client";

import { create } from "zustand";
import { refKey } from "@/lib/entity-ref";
import { CURRENT_USER } from "@/mock/users";
import { toAppError } from "@/services/errors";
import { watchService } from "@/services/watch-service";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef, WatchEntry } from "@/types";

/**
 * What the signed-in user follows (CO-WAT-28).
 *
 * The set of watched keys is kept as a `Record<string, true>` so a button can
 * subscribe to one boolean instead of to the whole list — toggling a watch
 * re-renders that button, not every row on screen.
 */

interface WatchState {
  readonly entries: readonly WatchEntry[];
  readonly watching: Readonly<Record<string, true>>;
  readonly isLoaded: boolean;
  /** Keys with a write in flight, so the button can disable itself. */
  readonly pending: Readonly<Record<string, true>>;
}

interface WatchActions {
  /** Loads once; later callers are no-ops until `refresh` asks for a re-read. */
  load: () => Promise<void>;
  /** Re-read the authoritative list — after a write the service made on its own. */
  refresh: () => Promise<void>;
  toggle: (ref: EntityRef) => Promise<void>;
}

export type WatchStore = WatchState & WatchActions;

const INITIAL: WatchState = { entries: [], watching: {}, isLoaded: false, pending: {} };

function indexOf(entries: readonly WatchEntry[]): Readonly<Record<string, true>> {
  return Object.fromEntries(entries.map((entry) => [entry.targetKey, true as const]));
}

export const useWatchStore = create<WatchStore>()((set, get) => ({
  ...INITIAL,

  load: async () => {
    if (get().isLoaded) return;
    await get().refresh();
  },

  /**
   * Posting a comment makes the author a watcher server-side. Nothing else
   * would tell the button about it, so the caller re-reads rather than the
   * store inventing a rule that could drift from the service's.
   */
  refresh: async () => {
    try {
      const entries = await watchService.list(CURRENT_USER.id);
      set({ entries, watching: indexOf(entries), isLoaded: true });
    } catch {
      // A failed load leaves every button in its "not watching" default; the
      // next toggle re-reads the authoritative list anyway.
      set({ isLoaded: true });
    }
  },

  toggle: async (ref) => {
    const key = refKey(ref);
    if (get().pending[key]) return;

    const wasWatching = Boolean(get().watching[key]);
    const next = !wasWatching;

    set((state) => ({
      watching: writeFlag(state.watching, key, next),
      pending: { ...state.pending, [key]: true as const },
    }));

    try {
      const entries = await watchService.setWatching({
        ref,
        userId: CURRENT_USER.id,
        isWatching: next,
      });

      set({ entries, watching: indexOf(entries) });
      useWorkspaceStore
        .getState()
        .pushFeedback(
          next ? `Following “${ref.label}”` : `Stopped following “${ref.label}”`,
          "info",
        );
    } catch (error) {
      set((state) => ({ watching: writeFlag(state.watching, key, wasWatching) }));
      useWorkspaceStore.getState().pushFeedback(toAppError(error).message, "error");
    } finally {
      set((state) => {
        const pending = { ...state.pending };
        delete pending[key];
        return { pending };
      });
    }
  },
}));

function writeFlag(
  flags: Readonly<Record<string, true>>,
  key: string,
  value: boolean,
): Readonly<Record<string, true>> {
  if (value) return { ...flags, [key]: true as const };

  const next = { ...flags };
  delete next[key];
  return next;
}

/* -------------------------------------------------------------- selectors */

/** One boolean per target — the only thing a watch button needs. */
export const selectIsWatching = (key: string) => (state: WatchStore) =>
  Boolean(state.watching[key]);

export const selectIsWatchPending = (key: string) => (state: WatchStore) =>
  Boolean(state.pending[key]);
