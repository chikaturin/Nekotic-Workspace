import { beforeEach, describe, expect, test } from "vitest";
import { MOCK_NOW, RECENT_LIMIT } from "@/config/app";
import {
  entityKindOf,
  isWatchable,
  nodeRef,
  opensDrawer,
  refEquals,
  refKey,
  rowRef,
} from "@/lib/entity-ref";
import { dropEntry, touchEntry } from "@/lib/lru";
import { lensesFor, isDone, DONE_LABELS } from "@/lib/my-work";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER, directoryAt } from "@/mock/users";
import { boardService } from "@/services/board-service";
import { boardIdFor } from "./msw/fake/board.fake";
import { commentService } from "@/services/comment-service";
import { myWorkFake } from "./msw/fake/my-work.fake";
import { watchService } from "@/services/watch-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useRecentStore } from "@/store/recent-store";
import { useWatchStore } from "@/store/watch-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef, MyWorkWidget, MyWorkWidgetId, RecentEntry } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";
import { collabFake } from "./msw/fake/collab.fake";

const WORKSPACE_ID = "ws_test";
const YESTERDAY = "2026-08-25T09:30:00.000Z";
const NEXT_MONTH = "2026-09-26T09:30:00.000Z";

const ROADMAP_BOARD = boardIdFor(ID.roadmap);
const rowIdAt = (index: number) => `${ROADMAP_BOARD}_row_${index}`;

function ref(index: number): EntityRef {
  return rowRef({
    nodeId: ID.roadmap,
    boardId: ROADMAP_BOARD,
    rowId: rowIdAt(index),
    label: `TASK-00${index}`,
  });
}

function widget(widgets: readonly MyWorkWidget[], id: MyWorkWidgetId): MyWorkWidget {
  const found = widgets.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing widget ${id}`);
  return found;
}

const rowIdsIn = (target: MyWorkWidget) => target.items.map((item) => item.ref.rowId);

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  useRecentStore.setState({ entries: [], isHydrated: true });
  useWatchStore.setState({ entries: [], watching: {}, isLoaded: false, pending: {} });

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    rowRequest: null,
    feedback: null,
    seed: 0,
  });
});

describe("entity references", () => {
  test("a record addresses its board and row; everything else its node", () => {
    const record = ref(1);
    expect(refKey(record)).toBe(`row:${ROADMAP_BOARD}:${rowIdAt(1)}`);
    expect(refKey({ kind: "document", nodeId: "nd_1", label: "Page" })).toBe("document:nd_1");
    expect(refEquals(record, ref(1))).toBe(true);
    expect(refEquals(record, ref(2))).toBe(false);
  });

  test("a node's kind and label come straight from the tree", () => {
    const tree = buildTestTree();
    const folder = findNodeById(tree, ID.payment)!;

    expect(entityKindOf(folder)).toBe("folder");
    expect(nodeRef(folder)).toEqual({ kind: "folder", nodeId: ID.payment, label: "Payment" });
  });

  test("only records open a drawer, and only three kinds can be watched", () => {
    expect(opensDrawer(ref(1))).toBe(true);
    expect(opensDrawer({ kind: "file", nodeId: "f", label: "a.png" })).toBe(false);

    expect(isWatchable(ref(1))).toBe(true);
    expect(isWatchable({ kind: "document", nodeId: "d", label: "Page" })).toBe(true);
    expect(isWatchable({ kind: "board", nodeId: "b", label: "Board" })).toBe(true);
    expect(isWatchable({ kind: "file", nodeId: "f", label: "a.png" })).toBe(false);
    expect(isWatchable({ kind: "folder", nodeId: "x", label: "Folder" })).toBe(false);
  });
});

describe("recent is least-recently-used", () => {
  const keyOf = (entry: RecentEntry) => refKey(entry.ref);
  const entry = (nodeId: string): RecentEntry => ({
    ref: { kind: "document", nodeId, label: nodeId },
    visitedAt: MOCK_NOW,
  });

  test("touching moves to the front without duplicating", () => {
    const list = touchEntry(touchEntry([], entry("a"), keyOf, 3), entry("b"), keyOf, 3);
    expect(list.map(keyOf)).toEqual(["document:b", "document:a"]);

    const revisited = touchEntry(list, entry("a"), keyOf, 3);
    expect(revisited.map(keyOf)).toEqual(["document:a", "document:b"]);
  });

  test("the tail past the limit falls off", () => {
    let list: readonly RecentEntry[] = [];
    for (let index = 0; index < 5; index += 1) list = touchEntry(list, entry(`n${index}`), keyOf, 3);

    expect(list.map(keyOf)).toEqual(["document:n4", "document:n3", "document:n2"]);
    expect(touchEntry(list, entry("x"), keyOf, 0)).toEqual([]);
  });

  test("dropping keeps identity when nothing matched", () => {
    const list = touchEntry([], entry("a"), keyOf, 3);
    expect(dropEntry(list, "document:missing", keyOf)).toBe(list);
    expect(dropEntry(list, "document:a", keyOf)).toEqual([]);
  });

  test("the store caps the history and clears on request", () => {
    const store = useRecentStore.getState();

    for (let index = 0; index < RECENT_LIMIT + 4; index += 1) {
      store.visit({ kind: "document", nodeId: `n${index}`, label: `Page ${index}` });
    }

    expect(useRecentStore.getState().entries).toHaveLength(RECENT_LIMIT);
    expect(useRecentStore.getState().entries[0]?.ref.nodeId).toBe(`n${RECENT_LIMIT + 3}`);

    store.remove(`document:n${RECENT_LIMIT + 3}`);
    expect(useRecentStore.getState().entries).toHaveLength(RECENT_LIMIT - 1);

    store.clear();
    expect(useRecentStore.getState().entries).toHaveLength(0);
  });
});

describe("watching", () => {
  test("a target can be followed and dropped again", async () => {
    const target = ref(1);

    const follows = (entries: readonly { targetKey: string }[]) =>
      entries.some((entry) => entry.targetKey === refKey(target));

    // `setWatching` chỉ nhận `ref`: người theo dõi luôn là phiên đang gọi.
    expect(follows(await watchService.setWatching(target, true))).toBe(true);
    expect(follows(await watchService.list())).toBe(true);

    expect(follows(await watchService.setWatching(target, false))).toBe(false);
  });

  test("the author is excluded from their own fan-out", async () => {
    const target = ref(1);
    const other = directoryAt(2);

    await watchService.setWatching(target, true);
    // Người thứ hai theo dõi được dựng ở phía SERVER: API không có đường để một
    // người bật theo dõi hộ người khác, và đó là điều đúng.
    collabFake.setWatch(target, other.id, true);

    // Hộp thư đã có sẵn thông báo mẫu, nên phép đo là TRƯỚC/SAU chứ không phải
    // một con số tuyệt đối.
    const mineBefore = collabFake.notifications(CURRENT_USER.id).length;
    const theirsBefore = collabFake.notifications(other.id).length;

    await commentService.add({ target, body: "shipping today" });

    // Tác giả KHÔNG nhận thông báo về bài của chính mình; người kia thì có.
    expect(collabFake.notifications(CURRENT_USER.id)).toHaveLength(mineBefore);
    expect(collabFake.notifications(other.id)).toHaveLength(theirsBefore + 1);
  });

  test("a folder cannot be watched", async () => {
    await expect(
      watchService.setWatching(
        { kind: "folder", nodeId: ID.payment, label: "Payment" },
        true,
      ),
    ).rejects.toThrow();
  });
});

describe("my work", () => {
  async function prepareBoard() {
    const snapshot = await boardService.getBoard(ID.roadmap);
    const lenses = lensesFor(snapshot.board);

    const assignee = lenses.assignee!.id;
    const due = lenses.due!.id;
    const status = lenses.status!.id;

    await boardService.updateCells({
      boardId: ROADMAP_BOARD,
      edits: [
        { rowId: rowIdAt(1), columnId: assignee, value: { kind: "user", userIds: [CURRENT_USER.id] } },
        { rowId: rowIdAt(1), columnId: due, value: { kind: "date", iso: MOCK_NOW } },
        { rowId: rowIdAt(1), columnId: status, value: { kind: "select", optionIds: ["status_1"] } },

        { rowId: rowIdAt(2), columnId: assignee, value: { kind: "user", userIds: [CURRENT_USER.id] } },
        { rowId: rowIdAt(2), columnId: due, value: { kind: "date", iso: YESTERDAY } },
        { rowId: rowIdAt(2), columnId: status, value: { kind: "select", optionIds: ["status_0"] } },

        // Assigned, overdue — but finished, so it drops out of every widget.
        { rowId: rowIdAt(3), columnId: assignee, value: { kind: "user", userIds: [CURRENT_USER.id] } },
        { rowId: rowIdAt(3), columnId: due, value: { kind: "date", iso: YESTERDAY } },
        { rowId: rowIdAt(3), columnId: status, value: { kind: "select", optionIds: ["status_4"] } },

        { rowId: rowIdAt(4), columnId: assignee, value: { kind: "user", userIds: [directoryAt(2).id] } },
        { rowId: rowIdAt(4), columnId: due, value: { kind: "date", iso: NEXT_MONTH } },
        { rowId: rowIdAt(4), columnId: status, value: { kind: "select", optionIds: ["status_0"] } },
      ],
    });

    return snapshot;
  }

  test("the four widgets read one record set", async () => {
    await prepareBoard();
    const widgets = await myWorkFake.load({ userId: CURRENT_USER.id, nowIso: MOCK_NOW });

    // Đúng bốn widget server trả về, đúng thứ tự đó.
    expect(widgets.map((entry) => entry.id)).toEqual([
      "overdue",
      "dueToday",
      "dueThisWeek",
      "unscheduled",
    ]);

    expect(rowIdsIn(widget(widgets, "dueToday"))).toEqual([rowIdAt(1)]);
    expect(rowIdsIn(widget(widgets, "overdue"))).toEqual([rowIdAt(2)]);
  });

  test("a record stands in exactly one widget", async () => {
    // Bốn widget là một PHÂN HOẠCH theo hạn, không phải bốn bộ lọc chồng nhau:
    // một việc quá hạn không được đếm thêm lần nữa ở "tuần này".
    await prepareBoard();
    const widgets = await myWorkFake.load({ userId: CURRENT_USER.id, nowIso: MOCK_NOW });

    const everywhere = widgets.flatMap((entry) => rowIdsIn(entry));

    expect(new Set(everywhere).size).toBe(everywhere.length);
  });

  test("a finished record leaves the open widgets", async () => {
    const snapshot = await prepareBoard();
    const lenses = lensesFor(snapshot.board);
    const done = (await boardService.getBoard(ID.roadmap)).rows.find(
      (row) => row.id === rowIdAt(3),
    )!;

    expect(isDone(done, lenses)).toBe(true);
    expect(DONE_LABELS.has("done")).toBe(true);

    const widgets = await myWorkFake.load({ userId: CURRENT_USER.id, nowIso: MOCK_NOW });

    for (const entry of widgets) expect(rowIdsIn(entry)).not.toContain(rowIdAt(3));
  });

  test("work assigned to somebody else never appears", async () => {
    await prepareBoard();
    const widgets = await myWorkFake.load({ userId: CURRENT_USER.id, nowIso: MOCK_NOW });

    for (const entry of widgets) expect(rowIdsIn(entry)).not.toContain(rowIdAt(4));
  });

  test("the widget count is the match count, not the rendered count", async () => {
    await prepareBoard();
    const widgets = await myWorkFake.load({
      userId: CURRENT_USER.id,
      nowIso: MOCK_NOW,
      limit: 1,
    });

    const total = widgets.reduce((sum, entry) => sum + entry.total, 0);
    const rendered = widgets.reduce((sum, entry) => sum + entry.items.length, 0);

    expect(total).toBe(2);
    expect(rendered).toBeLessThanOrEqual(total);
  });

  test("a board the user cannot open contributes nothing", async () => {
    await prepareBoard();
    const widgets = await myWorkFake.load({
      userId: CURRENT_USER.id,
      nowIso: MOCK_NOW,
      allow: () => false,
    });

    for (const entry of widgets) expect(entry.total).toBe(0);
  });
});
