"use client";

import { useEffect } from "react";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { AppError } from "@/types";

export interface BoardResource {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly error: AppError | null;
  readonly reload: () => void;
}

/**
 * Load one board into the store. Records are fetched once per node and every
 * view reads them from there, so switching views never refetches.
 */
export function useBoard(nodeId: string): BoardResource {
  const status = useBoardStore((state) => state.status);
  const error = useBoardStore((state) => state.error);
  const load = useBoardStore((state) => state.load);
  const reload = useBoardStore((state) => state.reload);
  const resetGrid = useGridStore((state) => state.reset);

  useEffect(() => {
    resetGrid();
    void load(nodeId);
  }, [nodeId, load, resetGrid]);

  return { status, error, reload: () => void reload() };
}
