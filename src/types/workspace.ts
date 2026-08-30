import type { WorkspaceMember } from "./user";

export type WorkspacePlan = "free" | "team" | "enterprise";

export interface StorageQuota {
  readonly usedBytes: number;
  readonly totalBytes: number;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly slug: string;
  readonly plan: WorkspacePlan;
  readonly badge: string;
  readonly color: string;
  readonly members: readonly WorkspaceMember[];
  readonly storage: StorageQuota;
}
