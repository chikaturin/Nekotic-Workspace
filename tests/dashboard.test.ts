import { beforeEach, describe, expect, test } from "vitest";
import {
  DEADLINE_BUCKETS,
  QA_BUCKETS,
  TASK_BUCKETS,
  deadlineBucketOf,
  isQaBoard,
  qaBucketOf,
  taskBucketOf,
} from "@/lib/dashboard";
import { lensesFor } from "@/lib/my-work";
import { board, hydrate, project, type NodeSpec } from "@/mock/factory";
import { boardService } from "@/services/board-service";
import { dashboardService } from "@/services/dashboard-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DashboardWidget, DriveNode } from "@/types";

/**
 * Dashboard (SY-DSH-44).
 *
 * The widgets read labels rather than ids, because the boards they cross come
 * from different templates. These tests pin the vocabulary and, more
 * importantly, pin what happens to a label no bucket claims.
 */

const WORKSPACE_ID = "ws_dash";
const NOW = "2026-08-26T09:30:00.000Z";

function buildTree(): readonly DriveNode[] {
  const specs: readonly NodeSpec[] = [
    project({
      name: "Platform",
      color: "var(--kind-code)",
      updatedHoursAgo: 1,
      children: [
        board({ name: "Sprint", boardKind: "table", templateId: "task", itemCount: 24, openCount: 9 }),
        board({ name: "Test Runs", boardKind: "table", templateId: "qa", itemCount: 16, openCount: 4 }),
        board({ name: "Defects", boardKind: "table", templateId: "bug", itemCount: 12, openCount: 5 }),
      ],
    }),
  ];

  return hydrate(specs, { workspaceId: WORKSPACE_ID, parentId: null, idPrefix: "w" });
}

const ID = {
  sprint: "w_platform_sprint",
  qa: "w_platform_test_runs",
  defects: "w_platform_defects",
} as const;

const widget = (widgets: readonly DashboardWidget[], id: string): DashboardWidget => {
  const found = widgets.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing widget: ${id}`);
  return found;
};

const bucket = (entry: DashboardWidget, id: string): number =>
  entry.buckets.find((candidate) => candidate.id === id)?.count ?? 0;

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  boardService.reset();

  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTree() },
    feedback: null,
    seed: 0,
  });
});

describe("bucket vocabulary", () => {
  test("the task buckets are the four the brief names", () => {
    expect(TASK_BUCKETS.map((entry) => entry.id)).toEqual(["todo", "doing", "review", "done"]);
    expect(QA_BUCKETS.map((entry) => entry.id)).toEqual(["passed", "failed", "blocked"]);
    expect(DEADLINE_BUCKETS.map((entry) => entry.id)).toEqual(["overdue", "today", "thisWeek"]);
  });

  test("labels are matched however they are cased or spaced", () => {
    expect(taskBucketOf("In Progress")).toBe("doing");
    expect(taskBucketOf("  to do ")).toBe("todo");
    expect(qaBucketOf("PASSED")).toBe("passed");
  });

  test("boards from different templates land in the same buckets", () => {
    // Bug boards speak a different dialect of the same idea.
    expect(taskBucketOf("New")).toBe("todo");
    expect(taskBucketOf("Triaged")).toBe("todo");
    expect(taskBucketOf("Fixed")).toBe("done");
    expect(taskBucketOf("Verified")).toBe("done");
  });

  test("a label no bucket claims is null, never the nearest guess", () => {
    expect(taskBucketOf("Won't fix")).toBeNull();
    expect(taskBucketOf(null)).toBeNull();
    expect(qaBucketOf("Not run")).toBeNull();
  });
});

describe("reading a board as QA", () => {
  test("a board is QA when its status column speaks in verdicts", async () => {
    const scan = await boardService.scanBoards();
    const qa = scan.find((entry) => entry.node.id === ID.qa);
    const sprint = scan.find((entry) => entry.node.id === ID.sprint);

    expect(isQaBoard(lensesFor(qa!.board))).toBe(true);
    expect(isQaBoard(lensesFor(sprint!.board))).toBe(false);
  });

  test("a board with no status column is not QA", async () => {
    const scan = await boardService.scanBoards();
    const lenses = { ...lensesFor(scan[0]!.board), status: null };

    expect(isQaBoard(lenses)).toBe(false);
  });
});

describe("deadline buckets", () => {
  const at = (day: string) => `${day}T12:00:00.000Z`;

  test("yesterday is overdue, today is today", () => {
    expect(deadlineBucketOf(at("2026-08-25"), NOW, 7)).toBe("overdue");
    expect(deadlineBucketOf(at("2026-08-26"), NOW, 7)).toBe("today");
  });

  test("tomorrow and the last day of the window are this week", () => {
    expect(deadlineBucketOf(at("2026-08-27"), NOW, 7)).toBe("thisWeek");
    expect(deadlineBucketOf(at("2026-09-02"), NOW, 7)).toBe("thisWeek");
  });

  test("past the window is no bucket at all", () => {
    expect(deadlineBucketOf(at("2026-09-03"), NOW, 7)).toBeNull();
    expect(deadlineBucketOf(null, NOW, 7)).toBeNull();
  });

  test("a date at either end of a day lands on the same day either way", () => {
    expect(deadlineBucketOf("2026-08-26T00:00:00.000Z", NOW, 7)).toBe("today");
    expect(deadlineBucketOf("2026-08-26T23:59:59.000Z", NOW, 7)).toBe("today");
  });
});

describe("the summary", () => {
  test("every record is either bucketed or reported as unmapped", async () => {
    const summary = await dashboardService.load({ nowIso: NOW });
    const task = widget(summary.widgets, "task");
    const qa = widget(summary.widgets, "qa");

    expect(task.total + task.unmapped + qa.total + qa.unmapped).toBe(summary.recordCount);
  });

  test("QA records are counted by the QA widget and by no other", async () => {
    const summary = await dashboardService.load({ nowIso: NOW });
    const qa = widget(summary.widgets, "qa");

    expect(qa.sources.map((source) => source.nodeId)).toEqual([ID.qa]);
    expect(widget(summary.widgets, "task").sources.map((source) => source.nodeId)).not.toContain(ID.qa);
    expect(bucket(qa, "passed") + bucket(qa, "failed") + bucket(qa, "blocked")).toBe(qa.total);
  });

  test("the task widget reads task and bug boards together", async () => {
    const summary = await dashboardService.load({ nowIso: NOW });
    const nodeIds = widget(summary.widgets, "task").sources.map((source) => source.nodeId);

    expect(nodeIds).toContain(ID.sprint);
    expect(nodeIds).toContain(ID.defects);
  });

  test("sources are ordered by how much each contributed", async () => {
    const summary = await dashboardService.load({ nowIso: NOW });
    const counts = widget(summary.widgets, "task").sources.map((source) => source.count);

    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  test("a board the gate excludes is never read, so it counts nothing", async () => {
    const summary = await dashboardService.load({
      nowIso: NOW,
      allow: (nodeId) => nodeId !== ID.qa,
    });

    expect(widget(summary.widgets, "qa").total).toBe(0);
    expect(summary.boardCount).toBe(2);
  });

  test("archived records drop out of every widget", async () => {
    const before = await dashboardService.load({ nowIso: NOW });
    const scan = await boardService.scanBoards();
    const sprint = scan.find((entry) => entry.node.id === ID.sprint)!;

    await boardService.bulkArchive({
      boardId: sprint.board.id,
      rowIds: sprint.rows.slice(0, 3).map((row) => row.id),
      isArchived: true,
    });

    const after = await dashboardService.load({ nowIso: NOW });
    expect(after.recordCount).toBe(before.recordCount - 3);
  });

  test("a workspace with no readable board is the onboarding case", async () => {
    const summary = await dashboardService.load({ nowIso: NOW, allow: () => false });

    expect(summary.isNewWorkspace).toBe(true);
    expect(summary.recordCount).toBe(0);
    expect(summary.widgets).toHaveLength(3);
  });

  test("an empty backend is the onboarding case too, not an error", async () => {
    setSimulation({ listFailure: "empty" });
    const summary = await dashboardService.load({ nowIso: NOW });

    expect(summary.isNewWorkspace).toBe(true);
  });

  test("a failing backend rejects rather than reporting zeroes as fact", async () => {
    setSimulation({ listFailure: "network" });
    await expect(dashboardService.load({ nowIso: NOW })).rejects.toThrow();
  });

  test("deadlines only count work that is still open", async () => {
    const summary = await dashboardService.load({ nowIso: NOW });
    const deadline = widget(summary.widgets, "deadline");

    expect(deadline.total).toBeLessThanOrEqual(summary.recordCount);
    expect(deadline.sources.every((source) => source.count > 0)).toBe(true);
  });
});
