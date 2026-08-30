import { isCancellation, toAppError } from "@/services/errors";
import type { AutosaveEvent } from "@/lib/autosave";

export interface SaveSchedulerOptions<T> {
  readonly save: (draft: T, signal: AbortSignal) => Promise<void>;
  readonly delayMs: number;
  readonly onEvent: (event: AutosaveEvent) => void;
  readonly isEnabled: () => boolean;
  readonly now?: () => string;
}

export interface SaveScheduler<T> {
  schedule: (draft: T) => void;
  flush: () => Promise<void>;
  retry: () => Promise<void>;
  dispose: (options?: { readonly flushPending?: boolean }) => void;
  hasPending: () => boolean;
}

export function createSaveScheduler<T>({
  save,
  delayMs,
  onEvent,
  isEnabled,
  now = () => new Date().toISOString(),
}: SaveSchedulerOptions<T>): SaveScheduler<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;
  let inFlight: AbortController | null = null;
  let isDisposed = false;

  function clearTimer(): void {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  async function commit(): Promise<void> {
    if (inFlight !== null || isDisposed) return;

    while (pending !== null && !isDisposed) {
      if (!isEnabled()) return;

      const draft = pending;
      const controller = new AbortController();

      inFlight = controller;
      onEvent({ type: "save-start" });

      try {
        await save(draft, controller.signal);
        onEvent({ type: "save-success", savedAt: now() });
      } catch (error) {
        const appError = toAppError(error);
        if (!isCancellation(appError)) {
          onEvent({ type: "save-error", message: appError.message });
        }
        return;
      } finally {
        inFlight = null;
      }

      if (pending === draft) pending = null;
    }
  }

  return {
    schedule(draft) {
      if (isDisposed) return;

      pending = draft;
      onEvent({ type: "edit" });
      if (!isEnabled()) return;

      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void commit();
      }, delayMs);
    },

    flush() {
      clearTimer();
      return isEnabled() ? commit() : Promise.resolve();
    },

    retry() {
      clearTimer();
      return isEnabled() ? commit() : Promise.resolve();
    },

    dispose({ flushPending = true } = {}) {
      clearTimer();

      if (flushPending && pending !== null && isEnabled()) {
        void commit();
        isDisposed = true;
        return;
      }

      isDisposed = true;
      inFlight?.abort();
    },

    hasPending: () => pending !== null,
  };
}
