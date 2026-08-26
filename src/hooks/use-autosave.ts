"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { AUTOSAVE_DEBOUNCE_MS, autosaveReducer, INITIAL_SAVE_STATE } from "@/lib/autosave";
import { createSaveScheduler, type SaveScheduler } from "@/lib/save-scheduler";
import type { SaveState } from "@/types";

interface UseAutosaveInput<T> {
  /** Persists the draft. Rejections surface as the `error` save state. */
  readonly save: (draft: T, signal: AbortSignal) => Promise<void>;
  readonly delayMs?: number;
  /** When false, edits are tracked but nothing is sent (locked pages). */
  readonly enabled?: boolean;
  readonly lastSavedAt?: string | null;
}

export interface Autosave<T> {
  readonly saveState: SaveState;
  /** Register an edit; the save fires once edits stop for `delayMs`. */
  readonly schedule: (draft: T) => void;
  /** Save immediately — used by ⌘S and before navigating away. */
  readonly flush: () => void;
  /** Re-send the last draft after a failure. */
  readonly retry: () => void;
}

/**
 * React binding for the save pipeline: the debounce, queueing and cancellation
 * live in `lib/save-scheduler`, the reported status in `lib/autosave`. This hook
 * only wires the two together and keeps the latest inputs reachable.
 */
export function useAutosave<T>({
  save,
  delayMs = AUTOSAVE_DEBOUNCE_MS,
  enabled = true,
  lastSavedAt = null,
}: UseAutosaveInput<T>): Autosave<T> {
  const [saveState, dispatch] = useReducer(autosaveReducer, {
    ...INITIAL_SAVE_STATE,
    lastSavedAt,
  });

  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    saveRef.current = save;
    enabledRef.current = enabled;
  }, [save, enabled]);

  // The scheduler owns timers and an abort controller, so it is built in an
  // effect rather than during render, and reached through a ref from handlers.
  const schedulerRef = useRef<SaveScheduler<T> | null>(null);

  useEffect(() => {
    const scheduler = createSaveScheduler<T>({
      save: (draft, signal) => saveRef.current(draft, signal),
      delayMs,
      onEvent: dispatch,
      isEnabled: () => enabledRef.current,
    });

    schedulerRef.current = scheduler;

    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, [delayMs]);

  return {
    saveState,
    schedule: useCallback((draft: T) => schedulerRef.current?.schedule(draft), []),
    flush: useCallback(() => void schedulerRef.current?.flush(), []),
    retry: useCallback(() => void schedulerRef.current?.retry(), []),
  };
}
