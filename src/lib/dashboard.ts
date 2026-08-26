import { dayKey } from "@/lib/board-dates";
import type { BoardLenses } from "@/lib/my-work";
import type {
  DeadlineBucketId,
  QaBucketId,
  SelectColor,
  TaskBucketId,
} from "@/types";

/**
 * Reading a board "as a dashboard" (SY-DSH-44).
 *
 * Boards come from different templates, so the widgets cannot address a status
 * by id. They read the *label*, which is what the user sees, and place it in a
 * bucket. A label no bucket claims is reported as unmapped rather than quietly
 * folded into the nearest one — a count you cannot trace is worse than a gap.
 */

interface BucketSpec<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly color: SelectColor;
  readonly labels: ReadonlySet<string>;
}

const set = (...labels: readonly string[]): ReadonlySet<string> => new Set(labels);

export const TASK_BUCKETS: readonly BucketSpec<TaskBucketId>[] = [
  {
    id: "todo",
    label: "Todo",
    color: "gray",
    labels: set("to do", "todo", "backlog", "new", "open", "triaged", "not started"),
  },
  {
    id: "doing",
    label: "Doing",
    color: "blue",
    labels: set("in progress", "doing", "active", "wip", "fixing"),
  },
  {
    id: "review",
    label: "Review",
    color: "violet",
    labels: set("in review", "review", "code review", "testing", "verifying", "pending review"),
  },
  {
    id: "done",
    label: "Done",
    color: "green",
    labels: set("done", "complete", "completed", "closed", "resolved", "fixed", "verified", "shipped", "released"),
  },
];

export const QA_BUCKETS: readonly BucketSpec<QaBucketId>[] = [
  { id: "passed", label: "Passed", color: "green", labels: set("passed", "pass", "ok") },
  { id: "failed", label: "Failed", color: "red", labels: set("failed", "fail", "failing") },
  { id: "blocked", label: "Blocked", color: "amber", labels: set("blocked", "on hold") },
];

export const DEADLINE_BUCKETS: readonly {
  readonly id: DeadlineBucketId;
  readonly label: string;
  readonly color: SelectColor;
}[] = [
  { id: "overdue", label: "Overdue", color: "red" },
  { id: "today", label: "Today", color: "amber" },
  { id: "thisWeek", label: "This week", color: "blue" },
];

function bucketFor<T extends string>(
  specs: readonly BucketSpec<T>[],
  label: string | null,
): T | null {
  if (label === null) return null;
  const needle = label.trim().toLowerCase();
  return specs.find((spec) => spec.labels.has(needle))?.id ?? null;
}

export const taskBucketOf = (label: string | null): TaskBucketId | null =>
  bucketFor(TASK_BUCKETS, label);

export const qaBucketOf = (label: string | null): QaBucketId | null =>
  bucketFor(QA_BUCKETS, label);

/**
 * A board is read as QA when its status column speaks in verdicts. Template id
 * is not enough: a board created from the QA template and then reshaped should
 * follow what it became, not what it was made from.
 */
export function isQaBoard(lenses: BoardLenses): boolean {
  if (!lenses.status) return false;

  return lenses.status.config.options.some((option) => {
    const label = option.label.trim().toLowerCase();
    return label === "passed" || label === "failed";
  });
}

/**
 * Which deadline bucket a due date falls in, or null for one that is further
 * out than the window. Compared by calendar day in UTC, the way every other
 * date reading in the app is, so "today" never drifts by a timezone.
 */
export function deadlineBucketOf(
  iso: string | null,
  nowIso: string,
  windowDays: number,
): DeadlineBucketId | null {
  const due = dayKey(iso);
  const today = dayKey(nowIso);
  if (due === null || today === null) return null;

  if (due < today) return "overdue";
  if (due === today) return "today";

  const horizon = dayKey(new Date(Date.parse(`${today}T00:00:00.000Z`) + windowDays * 86_400_000).toISOString());
  return horizon !== null && due <= horizon ? "thisWeek" : null;
}

/**
 * Solid fills for the distribution bar. The faint `SELECT_COLOR_CLASSES` chips
 * read as labels; a bar has to carry the proportion on its own, so it takes the
 * same tokens at full strength.
 */
export const BUCKET_BAR_CLASSES: Readonly<Record<SelectColor, string>> = {
  gray: "bg-kind-other",
  blue: "bg-kind-folder",
  green: "bg-kind-spreadsheet",
  amber: "bg-kind-archive",
  red: "bg-kind-pdf",
  violet: "bg-kind-board",
  cyan: "bg-kind-image",
  pink: "bg-kind-video",
};
