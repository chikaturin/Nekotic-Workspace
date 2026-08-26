"use client";

import { useCallback, useMemo } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/config/app";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useWorkspaceRole } from "@/hooks/use-permissions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { flattenGroups, totalResults } from "@/lib/search-index";
import { CURRENT_USER } from "@/mock/users";
import { searchService } from "@/services/search-service";
import type { AsyncState, SearchGroup, SearchResult } from "@/types";

/** Stable empty list — see the note in `use-comments`. */
const NO_GROUPS: readonly SearchGroup[] = [];

export interface GlobalSearch {
  readonly state: AsyncState<readonly SearchGroup[]>;
  readonly groups: readonly SearchGroup[];
  /** Groups flattened in render order — what arrow keys walk. */
  readonly flat: readonly SearchResult[];
  readonly total: number;
  /** True while the debounce is still holding a newer query. */
  readonly isTyping: boolean;
}

/**
 * Global search (CO-SCH-31), grouped by kind and scoped to what the signed-in
 * user may see. The role travels with the request so the permission rule stays
 * in `lib/permissions` rather than being re-derived here.
 */
export function useGlobalSearch(query: string): GlobalSearch {
  const role = useWorkspaceRole();
  const settled = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const loader = useCallback(
    (signal: AbortSignal) =>
      searchService.search({ query: settled, role, user: CURRENT_USER }, signal),
    [settled, role],
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
