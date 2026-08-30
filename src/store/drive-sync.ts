"use client";

import { driveApi } from "@/services/api/drive.api";
import { toAppError } from "@/services/errors";
import type { AppError } from "@/types";

export interface SyncOutcome<T> {
  readonly isOk: boolean;
  readonly data?: T;
  readonly error?: AppError;
}

export interface SyncHandlers<T> {
  readonly onSettled?: (data: T) => void;
  readonly onRevert: (error: AppError) => void;
}

export async function writeThrough<T>(
  call: () => Promise<T>,
  handlers: SyncHandlers<T>,
): Promise<SyncOutcome<T>> {
  try {
    const data = await call();

    handlers.onSettled?.(data);

    return { isOk: true, data };
  } catch (error: unknown) {
    const appError = toAppError(error);

    if (appError.code !== "cancelled") handlers.onRevert(appError);

    return { isOk: false, error: appError };
  }
}

export async function fetchTree(workspaceId: string, signal?: AbortSignal) {
  try {
    return await driveApi.tree(workspaceId, signal);
  } catch {
    return null;
  }
}
