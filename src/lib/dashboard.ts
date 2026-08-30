import { dayKey } from "@/lib/board-dates";
import { SELECT_SOLID_CLASSES } from "@/lib/board-schema";
import type { BoardLenses } from "@/lib/my-work";
import type {
  DeadlineBucketId,
  QaBucketId,
  SelectColor,
  TaskBucketId,
} from "@/types";

interface BucketSpec<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly color: SelectColor;
  readonly keywords: readonly string[];
}

export const TASK_BUCKETS: readonly BucketSpec<TaskBucketId>[] = [
  {
    id: "done",
    label: "Done",
    color: "green",
    keywords: [
      "done",
      "complete",
      "completed",
      "closed",
      "shipped",
      "released",
      "fixed",
      "wontfix",
      "published",
      "resolved",
    ],
  },
  {
    id: "blocked",
    label: "Blocked",
    color: "red",
    keywords: ["blocked", "block", "onhold", "hold", "waiting", "paused"],
  },
  {
    id: "inProgress",
    label: "In progress",
    color: "blue",
    keywords: ["inprogress", "progress", "doing", "active", "wip", "started", "review"],
  },
  {
    id: "todo",
    label: "To do",
    color: "gray",
    keywords: ["todo", "backlog", "new", "open", "planned", "ready", "triage", "draft"],
  },
];

export const QA_BUCKETS: readonly BucketSpec<QaBucketId>[] = [
  {
    id: "failed",
    label: "Failed",
    color: "red",
    keywords: ["fail", "failed", "rejected", "reopened", "broken"],
  },
  {
    id: "passed",
    label: "Passed",
    color: "green",
    keywords: ["pass", "passed", "verified", "approved", "accepted"],
  },
  {
    id: "inTesting",
    label: "In testing",
    color: "blue",
    keywords: ["testing", "intesting", "inreview", "review", "verifying", "qa"],
  },
  {
    id: "open",
    label: "Open",
    color: "gray",
    keywords: ["open", "new", "todo", "untested", "backlog", "draft"],
  },
];

export const DEADLINE_BUCKETS: readonly {
  readonly id: DeadlineBucketId;
  readonly label: string;
  readonly color: SelectColor;
}[] = [
  { id: "overdue", label: "Overdue", color: "red" },
  { id: "today", label: "Due today", color: "amber" },
  { id: "thisWeek", label: "This week", color: "blue" },
  { id: "later", label: "Later", color: "gray" },
  { id: "none", label: "No due date", color: "gray" },
];

function normalise(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bucketFor<T extends string>(
  specs: readonly BucketSpec<T>[],
  label: string | null,
): T | null {
  if (label === null) return null;

  const needle = normalise(label);
  if (needle === "") return null;

  return (
    specs.find((spec) => spec.keywords.some((keyword) => needle.includes(keyword)))?.id ?? null
  );
}

export const taskBucketOf = (label: string | null): TaskBucketId | null =>
  bucketFor(TASK_BUCKETS, label);

export const qaBucketOf = (label: string | null): QaBucketId | null =>
  bucketFor(QA_BUCKETS, label);

export function isQaBoard(lenses: BoardLenses): boolean {
  if (!lenses.status) return false;

  return lenses.status.config.options.some((option) => {
    const label = option.label.trim().toLowerCase();
    return label === "passed" || label === "failed";
  });
}

export function deadlineBucketOf(
  iso: string | null,
  nowIso: string,
  windowDays: number,
): DeadlineBucketId {
  const due = dayKey(iso);
  const today = dayKey(nowIso);
  if (today === null) return "none";
  if (due === null) return "none";

  if (due < today) return "overdue";
  if (due === today) return "today";

  const horizon = dayKey(
    new Date(Date.parse(`${today}T00:00:00.000Z`) + windowDays * 86_400_000).toISOString(),
  );

  return horizon !== null && due <= horizon ? "thisWeek" : "later";
}

export const BUCKET_BAR_CLASSES = SELECT_SOLID_CLASSES;
