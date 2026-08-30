"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { boardService, type BoardDescriptor } from "@/services/board-service";

export function useBoardList(): readonly BoardDescriptor[] {
  const loader = useCallback(
    (signal: AbortSignal) => boardService.listBoards(signal),
    [],
  );

  const { state } = useAsyncResource<readonly BoardDescriptor[]>(loader, {
    keepPreviousData: true,
  });

  return state.status === "success" ? state.data : [];
}
