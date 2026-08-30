import { DASHBOARD_WEEK_DAYS } from "@/config/app";
import {
  DEADLINE_BUCKETS,
  QA_BUCKETS,
  TASK_BUCKETS,
  deadlineBucketOf,
  isQaBoard,
  qaBucketOf,
  taskBucketOf,
} from "@/lib/dashboard";
import { dueOf, isDone, lensesFor, statusOf } from "@/lib/my-work";
import { assertNoSimulatedListFailure, isSimulatedEmpty, readDelay } from "@/services/backend";
import { boardFake } from "./board.fake";
import type {
  BoardNode,
  DashboardBucket,
  DashboardBucketId,
  DashboardSource,
  DashboardSummary,
  DashboardWidget,
  DashboardWidgetId,
} from "@/types";

/**
 * Dashboard (SY-DSH-44).
 *
 * Three readings of the boards the user may open — never a separate dataset.
 * The permission gate is passed in as a predicate, so a board they cannot see
 * is never read, let alone counted.
 */

interface WidgetDefinition {
  readonly id: DashboardWidgetId;
  readonly label: string;
  readonly description: string;
}

// Nhãn và mô tả lấy đúng của server (`dashboard.uc.ts`), để bộ offline và bản
// chạy thật không mô tả cùng một widget bằng hai câu khác nhau.
const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: "tasks",
    label: "Tasks",
    description: "Every open record across the boards you can see",
  },
  {
    id: "qa",
    label: "QA",
    description: "Test cases across boards built from the QA template",
  },
  {
    id: "deadlines",
    label: "Deadlines",
    description: "Records grouped by when they are due",
  },
] as const;

export interface DashboardInput {
  /** Permission gate, keyed by drive node id. Applied before a board is read. */
  readonly allow?: (nodeId: string) => boolean;
  /** Reference instant — the frozen clock in fixtures, `now` in production. */
  readonly nowIso: string;
  readonly weekDays?: number;
}

/** Running tallies for one widget while the scan walks the boards. */
class Tally {
  readonly counts = new Map<DashboardBucketId, number>();
  readonly sources = new Map<string, DashboardSource>();
  unmapped = 0;

  add(bucket: DashboardBucketId | null, node: BoardNode): void {
    if (bucket === null) {
      this.unmapped += 1;
      return;
    }

    this.counts.set(bucket, (this.counts.get(bucket) ?? 0) + 1);

    const current = this.sources.get(node.id);
    this.sources.set(node.id, {
      nodeId: node.id,
      name: node.name,
      count: (current?.count ?? 0) + 1,
    });
  }

  buckets(
    specs: readonly { readonly id: DashboardBucketId; readonly label: string; readonly color: DashboardBucket["color"] }[],
  ): readonly DashboardBucket[] {
    return specs.map((spec) => ({
      id: spec.id,
      label: spec.label,
      color: spec.color,
      count: this.counts.get(spec.id) ?? 0,
    }));
  }

  get total(): number {
    let sum = 0;
    for (const count of this.counts.values()) sum += count;
    return sum;
  }

  get contributors(): readonly DashboardSource[] {
    return [...this.sources.values()].sort((a, b) => b.count - a.count);
  }
}

async function load(
  { allow, nowIso, weekDays = DASHBOARD_WEEK_DAYS }: DashboardInput,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  const scan = await boardFake.scanBoards(
    allow ? { allow: (node: BoardNode) => allow(node.id) } : {},
    signal,
  );
  await readDelay(signal);
  assertNoSimulatedListFailure("the dashboard");

  const entries = isSimulatedEmpty() ? [] : scan;

  const task = new Tally();
  const qa = new Tally();
  const deadline = new Tally();
  let recordCount = 0;

  for (const entry of entries) {
    const lenses = lensesFor(entry.board);
    const isQa = isQaBoard(lenses);

    for (const row of entry.rows) {
      if (row.archivedAt) continue;
      recordCount += 1;

      const { label } = statusOf(row, lenses);

      if (isQa) qa.add(qaBucketOf(label), entry.node);
      else task.add(taskBucketOf(label), entry.node);

      // A deadline only counts while the work is still open — a finished task
      // that missed its date is history, not something to chase.
      if (lenses.due && !isDone(row, lenses)) {
        deadline.add(deadlineBucketOf(dueOf(row, lenses), nowIso, weekDays), entry.node);
      }
    }
  }

  const byWidget: Readonly<Record<DashboardWidgetId, DashboardWidget>> = {
    tasks: widget("tasks", task, TASK_BUCKETS),
    qa: widget("qa", qa, QA_BUCKETS),
    deadlines: widget("deadlines", deadline, DEADLINE_BUCKETS),
  };

  return {
    widgets: WIDGETS.map((definition) => byWidget[definition.id]),
    isNewWorkspace: recordCount === 0,
    boardCount: entries.length,
    recordCount,
  };
}

function widget(
  id: DashboardWidgetId,
  tally: Tally,
  specs: readonly { readonly id: DashboardBucketId; readonly label: string; readonly color: DashboardBucket["color"] }[],
): DashboardWidget {
  const definition = WIDGETS.find((candidate) => candidate.id === id)!;

  return {
    id,
    label: definition.label,
    description: definition.description,
    buckets: tally.buckets(specs),
    total: tally.total,
    unmapped: tally.unmapped,
    sources: tally.contributors,
  };
}

export const dashboardFake = { load, WIDGETS };
