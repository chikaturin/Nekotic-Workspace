"use client";

import type { ReactNode } from "react";
import { ErrorState, PermissionDeniedState } from "@/components/shared/state-panels";
import type { AsyncState } from "@/types";

interface AsyncBoundaryProps<T> {
  readonly state: AsyncState<T>;
  readonly loading: ReactNode;
  readonly empty?: ReactNode;
  readonly isEmpty?: (data: T) => boolean;
  readonly onRetry?: () => void;
  readonly children: (data: T) => ReactNode;
}

export function AsyncBoundary<T>({
  state,
  loading,
  empty,
  isEmpty,
  onRetry,
  children,
}: AsyncBoundaryProps<T>) {
  if (state.status === "idle" || state.status === "loading") return <>{loading}</>;

  if (state.status === "error") {
    return state.error.code === "permission_denied" ? (
      <PermissionDeniedState error={state.error} />
    ) : (
      <ErrorState error={state.error} onRetry={onRetry} />
    );
  }

  if (empty && isEmpty?.(state.data)) return <>{empty}</>;

  return <>{children(state.data)}</>;
}
