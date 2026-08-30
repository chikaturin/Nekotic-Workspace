"use client";

import { useCallback, useMemo } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/config/app";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { flattenGroups, totalResults } from "@/lib/search-index";
import { searchService } from "@/services/search-service";
import type { AsyncState, SearchGroup, SearchResult } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

const NO_GROUPS: readonly SearchGroup[] = [];

export interface GlobalSearch {
  readonly state: AsyncState<readonly SearchGroup[]>;
  readonly groups: readonly SearchGroup[];
  readonly flat: readonly SearchResult[];
  readonly total: number;
  readonly isTyping: boolean;
}

export function useGlobalSearch(query: string): GlobalSearch {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const settled = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const loader = useCallback(
    (signal: AbortSignal) =>
      searchService.search({ workspaceId, query: settled, signal }),
    [workspaceId, settled],
  );

  const { state } = useAsyncResource<readonly SearchGroup[]>(loader, {
    enabled: settled.length > 0,
    keepPreviousData: true,
  });

  const groups = useMemo(() => (state.status === "success" ? state.data : NO_GROUPS), [state]);
  const flat = useMemo(() => flattenGroups(groups), [groups]);

  return {
    state,
    groups,
    flat,
    total: totalResults(groups),
    isTyping: settled !== query.trim(),
  };
}
