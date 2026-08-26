import type { SelectColor } from "./board";

/**
 * Dashboard (SY-DSH-44).
 *
 * Three readings of the same record set — task progress, QA outcome and
 * deadlines. Every widget is a bucket count over boards the user may open, so
 * losing access to a board removes it from all three at once.
 */

export type DashboardWidgetId = "task" | "qa" | "deadline";

export type TaskBucketId = "todo" | "doing" | "review" | "done";
export type QaBucketId = "passed" | "failed" | "blocked";
export type DeadlineBucketId = "overdue" | "today" | "thisWeek";

export type DashboardBucketId = TaskBucketId | QaBucketId | DeadlineBucketId;

export interface DashboardBucket {
  readonly id: DashboardBucketId;
  readonly label: string;
  readonly count: number;
  readonly color: SelectColor;
}

/** A board that contributed to a widget, so the count can be traced. */
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
  /**
   * Records the widget saw but could not place in one of its buckets — a task
   * in a status no bucket claims. Reported rather than silently dropped.
   */
  readonly unmapped: number;
  readonly sources: readonly DashboardSource[];
}

export interface DashboardSummary {
  readonly widgets: readonly DashboardWidget[];
  /** No board the user can open holds any record — the onboarding case. */
  readonly isNewWorkspace: boolean;
  readonly boardCount: number;
  readonly recordCount: number;
}
