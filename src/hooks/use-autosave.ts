"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { AUTOSAVE_DEBOUNCE_MS, autosaveReducer, INITIAL_SAVE_STATE } from "@/lib/autosave";
import { createSaveScheduler, type SaveScheduler } from "@/lib/save-scheduler";
import type { SaveState } from "@/types";

interface UseAutosaveInput<T> {
  readonly save: (draft: T, signal: AbortSignal) => Promise<void>;
  readonly delayMs?: number;
  readonly enabled?: boolean;
  readonly lastSavedAt?: string | null;
}

export interface Autosave<T> {
  readonly saveState: SaveState;
  readonly schedule: (draft: T) => void;
  readonly flush: () => void;
  readonly retry: () => void;
}

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
