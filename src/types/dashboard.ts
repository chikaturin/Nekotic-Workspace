import type { SelectColor } from "./board";

export type DashboardWidgetId = "tasks" | "qa" | "deadlines";

export type TaskBucketId = "todo" | "inProgress" | "blocked" | "done";
export type QaBucketId = "open" | "inTesting" | "passed" | "failed";
export type DeadlineBucketId = "overdue" | "today" | "thisWeek" | "later" | "none";

export type DashboardBucketId = TaskBucketId | QaBucketId | DeadlineBucketId;

export interface DashboardBucket {
  readonly id: DashboardBucketId;
  readonly label: string;
  readonly count: number;
  readonly color: SelectColor;
}

export interface DashboardSource {
  readonly nodeId: string;
  readonly name: string;
  readonly count: number;
}

export interface DashboardWidget {
  readonly id: DashboardWidgetId;
  readonly label: string;
  readonly description: string;
  readonly buckets: readonly DashboardBucket[];
  readonly total: number;
  readonly unmapped: number;
  readonly sources: readonly DashboardSource[];
}

export interface DashboardSummary {
  readonly widgets: readonly DashboardWidget[];
  readonly isNewWorkspace: boolean;
  readonly boardCount: number;
  readonly recordCount: number;
}
