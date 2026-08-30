import { insightsApi } from "@/services/api/insights.api";
import type { MyWorkWidget } from "@/types";

export interface MyWorkInput {
  readonly workspaceId: string;
  readonly signal?: AbortSignal;
}

export const myWorkService = {
  load: ({ workspaceId, signal }: MyWorkInput): Promise<readonly MyWorkWidget[]> =>
    insightsApi.myWork(workspaceId, signal),
};
