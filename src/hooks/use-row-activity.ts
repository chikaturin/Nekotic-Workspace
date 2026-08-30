"use client";

import { useCallback, useMemo } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { groupActivityByDay, type ActivityDay } from "@/lib/activity";
import { boardService } from "@/services/board-service";
import type { ActivityEntry, AsyncState } from "@/types";

const NO_ENTRIES: readonly ActivityEntry[] = [];

export interface RowActivity {
  readonly state: AsyncState<readonly ActivityEntry[]>;
  readonly days: readonly ActivityDay[];
  readonly total: number;
  readonly reload: () => void;
}

export function useRowActivity(boardId: string, rowId: string): RowActivity {
  const loader = useCallback(
    (signal: AbortSignal) => boardService.listActivity(boardId, rowId, signal),
    [boardId, rowId],
  );

  const { state, reload } = useAsyncResource<readonly ActivityEntry[]>(loader, {
    keepPreviousData: true,
  });

  const entries = state.status === "success" ? state.data : NO_ENTRIES;
  const days = useMemo(() => groupActivityByDay(entries), [entries]);

  return { state, days, total: entries.length, reload };
}
