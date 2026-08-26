import { isCancellation, toAppError } from "@/services/errors";
import type { AutosaveEvent } from "@/lib/autosave";

export interface SaveSchedulerOptions<T> {
  /** Persists a draft. Rejections are reported as `save-error` events. */
  readonly save: (draft: T, signal: AbortSignal) => Promise<void>;
  readonly delayMs: number;
  readonly onEvent: (event: AutosaveEvent) => void;
  /** Checked lazily so a page that gets locked stops saving immediately. */
  readonly isEnabled: () => boolean;
  /** Injectable clock, so tests do not depend on wall time. */
  readonly now?: () => string;
}

export interface SaveScheduler<T> {
  /** Record an edit and (re)start the debounce window. */
  schedule: (draft: T) => void;
  /** Save right now, skipping the debounce. */
  flush: () => Promise<void>;
  /** Re-send the draft that failed. */
  retry: () => Promise<void>;
  /**
   * Stop scheduling. By default any pending edit is still sent — unmounting a
   * page during the debounce window must not throw the edit away.
   */
  dispose: (options?: { readonly flushPending?: boolean }) => void;
  /** True while an edit has not reached the service yet. */
  hasPending: () => boolean;
}

/**
 * Debounced save pipeline, free of React.
 *
 * The important guarantee: an edit that lands while a save is in flight is not
 * dropped — the loop re-reads the pending draft once the request settles, so
 * the last thing the user typed always reaches the service.
 */
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
    // Another run owns the queue; it will pick up whatever is pending.
    if (inFlight !== null || isDisposed) return;

    while (pending !== null && !isDisposed) {
      // A page can be locked mid-debounce; stop before the service rejects it.
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
        // Keep the draft pending so `retry` has something to send.
        return;
      } finally {
        inFlight = null;
      }

      // Nothing newer arrived while the request was in flight.
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
        // Fire and forget: the request outlives the component that started it.
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
