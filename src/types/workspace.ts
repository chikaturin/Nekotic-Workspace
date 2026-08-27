import type { WorkspaceMember } from "./user";

export type WorkspacePlan = "free" | "team" | "enterprise";

export interface StorageQuota {
  /** Bytes currently consumed by the workspace. */
  readonly usedBytes: number;
  /** Bytes granted by the current plan. */
  readonly totalBytes: number;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  /** What the workspace is for. Shown in the switcher and in settings. */
  readonly description?: string;
  /** URL-safe identifier, unique across the tenant. */
  readonly slug: string;
  readonly plan: WorkspacePlan;
  /** Short mark rendered in the switcher tile (1–2 chars). */
  readonly badge: string;
  /** CSS color used for the workspace tile. */
  readonly color: string;
  readonly members: readonly WorkspaceMember[];
  readonly storage: StorageQuota;
}
