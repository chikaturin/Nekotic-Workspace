/** Every failure that crosses a service boundary is normalised to this shape. */
export type AppErrorCode =
  | "permission_denied"
  | "not_found"
  | "network"
  | "validation"
  | "upload_failed"
  | "conflict"
  | "cancelled"
  | "unknown";

export interface AppError {
  readonly code: AppErrorCode;
  /** Message safe to render to the user. */
  readonly message: string;
  /** Extra context for support / logs — never required by the UI. */
  readonly detail?: string;
  /** Whether offering a retry makes sense. */
  readonly isRetryable: boolean;
}

/** Discriminated resource state consumed by `AsyncBoundary`. */
export type AsyncState<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error"; readonly error: AppError };

export const idleState = <T,>(): AsyncState<T> => ({ status: "idle" });
export const loadingState = <T,>(): AsyncState<T> => ({ status: "loading" });
export const successState = <T,>(data: T): AsyncState<T> => ({ status: "success", data });
export const errorState = <T,>(error: AppError): AsyncState<T> => ({ status: "error", error });
