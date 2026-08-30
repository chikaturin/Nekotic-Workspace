"use client";

import { create } from "zustand";
import { refKey } from "@/lib/entity-ref";
import { toAppError } from "@/services/errors";
import { watchService } from "@/services/watch-service";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef, WatchEntry } from "@/types";

interface WatchState {
  readonly entries: readonly WatchEntry[];
  readonly watching: Readonly<Record<string, true>>;
  readonly isLoaded: boolean;
  readonly pending: Readonly<Record<string, true>>;
}

interface WatchActions {
  load: () => Promise<void>;
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

  refresh: async () => {
    try {
      const entries = await watchService.list();
      set({ entries, watching: indexOf(entries), isLoaded: true });
    } catch {
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
      const entries = await watchService.setWatching(ref, next);

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

export const selectIsWatching = (key: string) => (state: WatchStore) =>
  Boolean(state.watching[key]);

export const selectIsWatchPending = (key: string) => (state: WatchStore) =>
  Boolean(state.pending[key]);
