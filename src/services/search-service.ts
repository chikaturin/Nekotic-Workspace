import { insightsApi } from "@/services/api/insights.api";
import type { SearchGroup } from "@/types";

export interface SearchInput {
  readonly workspaceId: string;
  readonly query: string;
  readonly signal?: AbortSignal;
}

export const searchService = {
  search: ({ workspaceId, query, signal }: SearchInput): Promise<readonly SearchGroup[]> =>
    insightsApi.search(workspaceId, query, signal),
};
