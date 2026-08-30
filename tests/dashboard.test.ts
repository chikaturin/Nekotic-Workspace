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
import { dashboardFake } from "./msw/fake/dashboard.fake";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DashboardWidget, DriveNode } from "@/types";

/**
 * Dashboard (SY-DSH-44).
 *
 * Phép gộp được kiểm ở `dashboardFake` — nơi nó thật sự sống sau khi
 * `dashboardService` trở thành một lời gọi HTTP. Kiểm qua service chỉ chứng
 * minh được `fetch` chạy; thứ đáng kiểm là việc xếp bản ghi vào đúng ô.
 *
 * The widgets read labels rather than ids, because the boards they cross come
 * from different templates. These tests pin the vocabulary and, more
 * importantly, pin what happens to a label no bucket claims.
 */

import { testWorkspace } from "./helpers";
import { boardFake } from "./msw/fake/board.fake";

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

  useWorkspaceStore.setState({
    workspaces: [testWorkspace(WORKSPACE_ID)],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTree() },
    feedback: null,
    seed: 0,
  });
});

describe("bucket vocabulary", () => {
  test("the buckets are exactly the ones the server sends", () => {
    // Thứ tự ở đây là thứ tự ƯU TIÊN khi khớp nhãn, không phải thứ tự hiển thị:
    // "Closed — won't do" mang cả ý kết thúc lẫn ý chưa làm, và ý kết thúc thắng.
    expect(TASK_BUCKETS.map((entry) => entry.id)).toEqual([
      "done",
      "blocked",
      "inProgress",
      "todo",
    ]);
    expect(QA_BUCKETS.map((entry) => entry.id)).toEqual([
      "failed",
      "passed",
      "inTesting",
      "open",
    ]);
    expect(DEADLINE_BUCKETS.map((entry) => entry.id)).toEqual([
      "overdue",
      "today",
      "thisWeek",
      "later",
      "none",
    ]);
  });

  test("labels are matched however they are cased, spaced or punctuated", () => {
    expect(taskBucketOf("In Progress")).toBe("inProgress");
    expect(taskBucketOf("  to do ")).toBe("todo");
    expect(taskBucketOf("In-Progress (BE)")).toBe("inProgress");
    expect(qaBucketOf("PASSED")).toBe("passed");
  });

  test("boards from different templates land in the same buckets", () => {
    // Bug và API docs nói phương ngữ khác của cùng một ý.
    expect(taskBucketOf("New")).toBe("todo");
    expect(taskBucketOf("Triage")).toBe("todo");
    expect(taskBucketOf("Draft")).toBe("todo");
    expect(taskBucketOf("Fixed")).toBe("done");
    expect(taskBucketOf("Won't fix")).toBe("done");
    expect(taskBucketOf("Published")).toBe("done");
  });

  test("a label no bucket claims is null, never the nearest guess", () => {
    expect(taskBucketOf("Escalated")).toBeNull();
    expect(taskBucketOf(null)).toBeNull();
    expect(taskBucketOf("   ")).toBeNull();
    expect(qaBucketOf("Deferred")).toBeNull();
  });

  test("a finished label beats an unstarted one in the same string", () => {
    // "Closed - won't do" chứa cả "closed" lẫn "todo"; thứ tự bảng quyết định.
    expect(taskBucketOf("Closed - won't do")).toBe("done");
  });
});

describe("reading a board as QA", () => {
  test("a board is QA when its status column speaks in verdicts", async () => {
    const scan = await boardFake.scanBoards();
    const qa = scan.find((entry) => entry.node.id === ID.qa);
    const sprint = scan.find((entry) => entry.node.id === ID.sprint);

    expect(isQaBoard(lensesFor(qa!.board))).toBe(true);
    expect(isQaBoard(lensesFor(sprint!.board))).toBe(false);
  });

  test("a board with no status column is not QA", async () => {
    const scan = await boardFake.scanBoards();
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

  test("past the window is Later, and no date at all is None", () => {
    // Mọi record đều có chỗ đứng: widget deadline không đọc nhãn nào, nên nó
    // không có khái niệm "không bucket nào nhận".
    expect(deadlineBucketOf(at("2026-09-03"), NOW, 7)).toBe("later");
    expect(deadlineBucketOf(null, NOW, 7)).toBe("none");
  });

  test("a date at either end of a day lands on the same day either way", () => {
    expect(deadlineBucketOf("2026-08-26T00:00:00.000Z", NOW, 7)).toBe("today");
    expect(deadlineBucketOf("2026-08-26T23:59:59.000Z", NOW, 7)).toBe("today");
  });
});

describe("the summary", () => {
  test("every record is either bucketed or reported as unmapped", async () => {
    const summary = await dashboardFake.load({ nowIso: NOW });
    const task = widget(summary.widgets, "tasks");
    const qa = widget(summary.widgets, "qa");

    expect(task.total + task.unmapped + qa.total + qa.unmapped).toBe(summary.recordCount);
  });

  test("QA records are counted by the QA widget and by no other", async () => {
    const summary = await dashboardFake.load({ nowIso: NOW });
    const qa = widget(summary.widgets, "qa");

    expect(qa.sources.map((source) => source.nodeId)).toEqual([ID.qa]);
    expect(widget(summary.widgets, "tasks").sources.map((source) => source.nodeId)).not.toContain(ID.qa);
    expect(bucket(qa, "passed") + bucket(qa, "failed") + bucket(qa, "inTesting") + bucket(qa, "open")).toBe(qa.total);
  });

  test("the task widget reads task and bug boards together", async () => {
    const summary = await dashboardFake.load({ nowIso: NOW });
    const nodeIds = widget(summary.widgets, "tasks").sources.map((source) => source.nodeId);

    expect(nodeIds).toContain(ID.sprint);
    expect(nodeIds).toContain(ID.defects);
  });

  test("sources are ordered by how much each contributed", async () => {
    const summary = await dashboardFake.load({ nowIso: NOW });
    const counts = widget(summary.widgets, "tasks").sources.map((source) => source.count);

    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  test("a board the gate excludes is never read, so it counts nothing", async () => {
    const summary = await dashboardFake.load({
      nowIso: NOW,
      allow: (nodeId) => nodeId !== ID.qa,
    });

    expect(widget(summary.widgets, "qa").total).toBe(0);
    expect(summary.boardCount).toBe(2);
  });

  test("archived records drop out of every widget", async () => {
    const before = await dashboardFake.load({ nowIso: NOW });
    const scan = await boardFake.scanBoards();
    const sprint = scan.find((entry) => entry.node.id === ID.sprint)!;

    await boardService.bulkArchive({
      boardId: sprint.board.id,
      rowIds: sprint.rows.slice(0, 3).map((row) => row.id),
      isArchived: true,
    });

    const after = await dashboardFake.load({ nowIso: NOW });
    expect(after.recordCount).toBe(before.recordCount - 3);
  });

  test("a workspace with no readable board is the onboarding case", async () => {
    const summary = await dashboardFake.load({ nowIso: NOW, allow: () => false });

    expect(summary.isNewWorkspace).toBe(true);
    expect(summary.recordCount).toBe(0);
    expect(summary.widgets).toHaveLength(3);
  });

  test("an empty backend is the onboarding case too, not an error", async () => {
    setSimulation({ listFailure: "empty" });
    const summary = await dashboardFake.load({ nowIso: NOW });

    expect(summary.isNewWorkspace).toBe(true);
  });

  test("a failing backend rejects rather than reporting zeroes as fact", async () => {
    setSimulation({ listFailure: "network" });
    await expect(dashboardFake.load({ nowIso: NOW })).rejects.toThrow();
  });

  test("deadlines only count work that is still open", async () => {
    const summary = await dashboardFake.load({ nowIso: NOW });
    const deadline = widget(summary.widgets, "deadlines");

    expect(deadline.total).toBeLessThanOrEqual(summary.recordCount);
    expect(deadline.sources.every((source) => source.count > 0)).toBe(true);
  });
});
