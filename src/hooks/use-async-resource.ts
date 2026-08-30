"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isCancellation, toAppError } from "@/services/errors";
import { errorState, idleState, loadingState, successState, type AsyncState } from "@/types";

interface Settled<T> {
  readonly token: object;
  readonly state: AsyncState<T>;
}

export interface AsyncResource<T> {
  readonly state: AsyncState<T>;
  readonly isRefreshing: boolean;
  readonly reload: () => void;
  readonly setData: (data: T) => void;
  readonly patchData: (update: (current: T) => T) => void;
}

export function useAsyncResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean; keepPreviousData?: boolean } = {},
): AsyncResource<T> {
  const { enabled = true, keepPreviousData = false } = options;

  const [reloadToken, setReloadToken] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

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

  const isRefreshing = enabled && !isSettled && settled?.state.status === "success";

  return { state, isRefreshing, reload, setData, patchData };
}
