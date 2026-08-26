"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isCancellation, toAppError } from "@/services/errors";
import { errorState, idleState, loadingState, successState, type AsyncState } from "@/types";

interface Settled<T> {
  /** Identity of the request this result belongs to. */
  readonly token: object;
  readonly state: AsyncState<T>;
}

export interface AsyncResource<T> {
  readonly state: AsyncState<T>;
  /** True while a reload runs on top of data that is already on screen. */
  readonly isRefreshing: boolean;
  /** Re-run the loader — wired to every "Try again" button. */
  readonly reload: () => void;
  /** Replace the loaded value locally after a successful mutation. */
  readonly setData: (data: T) => void;
  /**
   * Update the loaded value in place. Used where several writers touch the
   * same list — an optimistic insert and a realtime frame, for instance — and
   * each needs to build on whatever the others already applied.
   */
  readonly patchData: (update: (current: T) => T) => void;
}

/**
 * Load a service call into an `AsyncState`.
 *
 * The loading state is derived from "no settled result for this request yet"
 * rather than pushed from the effect, so mounting costs one render and the
 * effect never sets state synchronously. In-flight work is aborted when the
 * loader changes or the component unmounts, and a cancellation is never
 * reported as an error.
 */
export function useAsyncResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean; keepPreviousData?: boolean } = {},
): AsyncResource<T> {
  const { enabled = true, keepPreviousData = false } = options;

  const [reloadToken, setReloadToken] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  // A fresh identity per request: a new loader or an explicit reload.
  const requestToken = useMemo(() => ({ loader, reloadToken }), [loader, reloadToken]);
  const isSettled = settled?.token === requestToken;

  const run = useCallback(
    (token: object, signal: AbortSignal) =>
      loader(signal).then(
        (data) => {
          if (signal.aborted) return;
          setSettled({ token, state: successState(data) });
        },
        (error: unknown) => {
          const appError = toAppError(error);
          if (signal.aborted || isCancellation(appError)) return;
          setSettled({ token, state: errorState<T>(appError) });
        },
      ),
    [loader],
  );

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    void run(requestToken, controller.signal);
    return () => controller.abort();
  }, [run, enabled, requestToken]);

  const state = useMemo<AsyncState<T>>(() => {
    if (!enabled) return idleState<T>();
    if (isSettled && settled) return settled.state;

    // Keep the previous page of data visible while a reload is in flight.
    if (keepPreviousData && settled?.state.status === "success") return settled.state;
    return loadingState<T>();
  }, [enabled, isSettled, settled, keepPreviousData]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const setData = useCallback(
    (data: T) => setSettled({ token: requestToken, state: successState(data) }),
    [requestToken],
  );

  const patchData = useCallback(
    (update: (current: T) => T) =>
      setSettled((current) =>
        current && current.state.status === "success"
          ? { token: current.token, state: successState(update(current.state.data)) }
          : current,
      ),
    [],
  );

  // Refreshing means "reloading on top of data already on screen" — the first
  // load is a plain loading state, not a refresh.
  const isRefreshing = enabled && !isSettled && settled?.state.status === "success";

  return { state, isRefreshing, reload, setData, patchData };
}
