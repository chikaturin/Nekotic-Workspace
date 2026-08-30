import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RECENT_LIMIT } from "@/config/app";
import { hrefForRef, refKey, rowRef } from "@/lib/entity-ref";
import { assigneeIds, dueOf, lensesFor, statusOf, titleOf } from "@/lib/my-work";
import { createRealtimeClient } from "@/lib/realtime/client";
import { createLocalTransport } from "@/lib/realtime/transport";
import { CURRENT_USER, directoryAt } from "@/mock/users";
import { boardService } from "@/services/board-service";
import { boardIdFor } from "./msw/fake/board.fake";
import { commentService } from "@/services/comment-service";
import { notificationService } from "@/services/notification-service";
import { collabFake } from "./msw/fake/collab.fake";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useNotificationStore } from "@/store/notification-store";
import { useRecentStore } from "@/store/recent-store";
import { selectIsWatching, useWatchStore } from "@/store/watch-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardRow, EntityRef, RealtimeEvent } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

const WORKSPACE_ID = "ws_test";
const ROADMAP_BOARD = boardIdFor(ID.roadmap);

const recordRef = (index = 1): EntityRef =>
  rowRef({
    nodeId: ID.roadmap,
    boardId: ROADMAP_BOARD,
    rowId: `${ROADMAP_BOARD}_row_${index}`,
    label: `TASK-00${index}`,
  });

/** Minimal storage stand-in — the node test environment has no `window`. */
function installStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        removeItem: (key: string) => void map.delete(key),
      },
    },
  });

  return map;
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  useNotificationStore.setState({
    status: "idle",
    error: null,
    notifications: [],
    tab: "all",
    isPanelOpen: false,
  });
  useWatchStore.setState({ entries: [], watching: {}, isLoaded: false, pending: {} });
  useRecentStore.setState({ entries: [], isHydrated: false });

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    rowRequest: null,
    feedback: null,
    seed: 0,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("notification service", () => {
  test("an inbox only ever returns its owner's notifications", async () => {
    collabFake.emitForTest({
      reason: "mention",
      recipientId: directoryAt(1).id,
      actor: CURRENT_USER,
      title: "for Mai",
      body: "",
      target: null,
    });

    // `list()` KHÔNG nhận id: hộp thư luôn là của phiên đang đăng nhập, nên
    // không có tham số nào để đọc trộm hộp thư người khác.
    const mine = await notificationService.list();

    expect(mine.every((item) => item.recipientId === CURRENT_USER.id)).toBe(true);
    expect(mine.some((item) => item.title === "for Mai")).toBe(false);

    expect(
      collabFake.notifications(directoryAt(1).id).map((item) => item.title),
    ).toEqual(["for Mai"]);
  });

  test("marking read is scoped to the caller's own inbox", async () => {
    const foreign = collabFake.emitForTest({
      reason: "mention",
      recipientId: directoryAt(1).id,
      actor: CURRENT_USER,
      title: "for Mai",
      body: "",
      target: null,
    });

    // Id ngoài hộp thư của người gọi bị BỎ QUA, không phải áp dụng.
    await notificationService.markRead([foreign.id]);

    expect(collabFake.notifications(directoryAt(1).id)[0]?.isRead).toBe(false);
  });

  test("mark all read clears one inbox and leaves the others alone", async () => {
    collabFake.emitForTest({
      reason: "mention",
      recipientId: directoryAt(1).id,
      actor: CURRENT_USER,
      title: "for Mai",
      body: "",
      target: null,
    });

    await notificationService.markAllRead();

    expect((await notificationService.list()).every((item) => item.isRead)).toBe(
      true,
    );
    expect(collabFake.notifications(directoryAt(1).id)[0]?.isRead).toBe(false);
  });
});

describe("notification store", () => {
  test("loading runs once and refreshing re-reads", async () => {
    const store = useNotificationStore.getState();

    await store.load();
    const first = useNotificationStore.getState();
    expect(first.status).toBe("ready");
    expect(first.notifications.length).toBeGreaterThan(0);

    // A second load is a no-op; only an explicit refresh goes back out.
    await store.load();
    expect(useNotificationStore.getState().notifications).toBe(first.notifications);

    await store.refresh();
    expect(useNotificationStore.getState().status).toBe("ready");
  });

  test("a failed load surfaces the error", async () => {
    setSimulation({ listFailure: "network" });

    // The service list has no simulated failure switch, so failure is injected.
    const spy = vi
      .spyOn(notificationService, "list")
      .mockRejectedValueOnce(new Error("offline"));

    await useNotificationStore.getState().refresh();
    const state = useNotificationStore.getState();

    expect(state.status).toBe("error");
    expect(state.error?.code).toBe("unknown");
    spy.mockRestore();
  });

  test("clicking one row and clearing the inbox both settle on the service", async () => {
    await useNotificationStore.getState().load();
    const unread = useNotificationStore
      .getState()
      .notifications.filter((item) => !item.isRead);

    expect(unread.length).toBeGreaterThan(1);

    await useNotificationStore.getState().markRead(unread[0]!.id);
    expect(
      useNotificationStore.getState().notifications.find((item) => item.id === unread[0]!.id)
        ?.isRead,
    ).toBe(true);

    // Marking one already-read row again does nothing.
    await useNotificationStore.getState().markRead(unread[0]!.id);

    await useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().notifications.every((item) => item.isRead)).toBe(true);

    // And once everything is read, the action short-circuits.
    await useNotificationStore.getState().markAllRead();
  });

  test("tabs and the panel are plain view state", () => {
    const store = useNotificationStore.getState();

    store.setTab("mentions");
    store.setPanelOpen(true);

    expect(useNotificationStore.getState().tab).toBe("mentions");
    expect(useNotificationStore.getState().isPanelOpen).toBe(true);
  });
});

describe("watch store", () => {
  test("following a record flips one boolean and reports it", async () => {
    const target = recordRef();
    const key = refKey(target);

    await useWatchStore.getState().load();
    expect(selectIsWatching(key)(useWatchStore.getState())).toBe(false);

    await useWatchStore.getState().toggle(target);
    expect(selectIsWatching(key)(useWatchStore.getState())).toBe(true);
    expect(useWorkspaceStore.getState().feedback?.message).toContain("Following");

    await useWatchStore.getState().toggle(target);
    expect(selectIsWatching(key)(useWatchStore.getState())).toBe(false);
    expect(useWorkspaceStore.getState().feedback?.message).toContain("Stopped following");
  });

  test("a rejected write rolls the button back", async () => {
    const folder: EntityRef = { kind: "folder", nodeId: ID.payment, label: "Payment" };

    await useWatchStore.getState().toggle(folder);

    expect(selectIsWatching(refKey(folder))(useWatchStore.getState())).toBe(false);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  test("loading twice keeps the first answer; refreshing re-reads", async () => {
    await useWatchStore.getState().load();
    const entries = useWatchStore.getState().entries;

    await useWatchStore.getState().load();
    expect(useWatchStore.getState().entries).toBe(entries);

    await useWatchStore.getState().refresh();
    expect(useWatchStore.getState().entries).not.toBe(entries);
  });

  test("commenting makes the author a watcher, and a refresh sees it", async () => {
    const target = recordRef();
    await boardService.getBoard(ID.roadmap);

    await useWatchStore.getState().load();
    expect(selectIsWatching(refKey(target))(useWatchStore.getState())).toBe(false);

    await commentService.add({ target, body: "picking this up" });
    await useWatchStore.getState().refresh();

    // Without the refresh the button would still read "Watch", and its next
    // click would send a server no-op while toasting "Following".
    expect(selectIsWatching(refKey(target))(useWatchStore.getState())).toBe(true);
  });
});

describe("recent store persistence", () => {
  test("a visit survives a reload of the same browser", () => {
    const storage = installStorage();

    useRecentStore.getState().visit({ kind: "document", nodeId: "nd_1", label: "Page" });
    expect(storage.get("nekotic-recent")).toContain("nd_1");

    useRecentStore.setState({ entries: [], isHydrated: false });
    useRecentStore.getState().hydrate();

    expect(useRecentStore.getState().entries.map((entry) => entry.ref.nodeId)).toEqual(["nd_1"]);
    // Hydrating again is a no-op.
    useRecentStore.getState().hydrate();
    expect(useRecentStore.getState().entries).toHaveLength(1);
  });

  test("unreadable or malformed storage yields an empty history", () => {
    installStorage({ "nekotic-recent": "not json" });
    useRecentStore.getState().hydrate();
    expect(useRecentStore.getState().entries).toEqual([]);

    useRecentStore.setState({ entries: [], isHydrated: false });
    installStorage({ "nekotic-recent": JSON.stringify({ nope: true }) });
    useRecentStore.getState().hydrate();
    expect(useRecentStore.getState().entries).toEqual([]);
  });

  test("entries that do not look like entries are dropped", () => {
    installStorage({
      "nekotic-recent": JSON.stringify([
        { ref: { kind: "document", nodeId: "nd_1", label: "Page" }, visitedAt: "2026-08-26" },
        { ref: null, visitedAt: "2026-08-26" },
        { ref: { kind: "document" }, visitedAt: "2026-08-26" },
        { visitedAt: 12 },
        "nonsense",
      ]),
    });

    useRecentStore.getState().hydrate();
    expect(useRecentStore.getState().entries).toHaveLength(1);
  });

  test("removing something that is not there changes nothing", () => {
    installStorage();
    useRecentStore.getState().visit({ kind: "document", nodeId: "nd_1", label: "Page" });

    const before = useRecentStore.getState().entries;
    useRecentStore.getState().remove("document:missing");
    expect(useRecentStore.getState().entries).toBe(before);
    expect(before.length).toBeLessThanOrEqual(RECENT_LIMIT);
  });

  test("a browser that blocks storage still tracks the session", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
          setItem: () => {
            throw new Error("blocked");
          },
          removeItem: () => {
            throw new Error("blocked");
          },
        },
      },
    });

    useRecentStore.getState().hydrate();
    useRecentStore.getState().visit({ kind: "board", nodeId: "nd_b", label: "Board" });

    expect(useRecentStore.getState().entries).toHaveLength(1);
  });
});

describe("realtime client lifecycle", () => {
  test("closing detaches from the transport", () => {
    const transport = createLocalTransport();
    const client = createRealtimeClient(transport);

    client.connect();
    // Connecting twice must not double-subscribe.
    client.connect();

    const handler = vi.fn();
    client.subscribe(handler);
    client.emit({ type: "notification.read", notificationIds: [] });
    expect(handler).toHaveBeenCalledTimes(1);

    client.close();
    expect(client.status).toBe("closed");

    client.emit({ type: "notification.read", notificationIds: [] });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("resetting forgets the handlers and the delivery history", () => {
    const transport = createLocalTransport();
    const client = createRealtimeClient(transport);
    client.connect();

    const handler = vi.fn();
    client.subscribe(handler);

    const event: RealtimeEvent = {
      id: "evt_1",
      at: "2026-08-26T09:00:00.000Z",
      origin: "remote",
      payload: { type: "notification.read", notificationIds: [] },
    };

    transport.publish(event);
    expect(client.duplicatesDropped).toBe(0);

    client.reset();
    transport.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(client.duplicatesDropped).toBe(0);
  });
});

describe("reading a board as work", () => {
  test("a board without the columns for a role simply reports none", async () => {
    const snapshot = await boardService.getBoard(ID.roadmap);
    const lenses = lensesFor(snapshot.board);
    const row = snapshot.rows[0]!;

    const bare = { ...lenses, status: null, due: null, assignee: null, primary: null };

    expect(statusOf(row, bare)).toEqual({ label: null, color: null });
    expect(dueOf(row, bare)).toBeNull();
    expect(assigneeIds(row, bare)).toEqual([]);
    expect(titleOf(row, bare)).toBe(row.displayId);
  });

  test("an untitled record still reads as something", async () => {
    const snapshot = await boardService.getBoard(ID.roadmap);
    const lenses = lensesFor(snapshot.board);

    const blank: BoardRow = {
      ...snapshot.rows[0]!,
      cells: { ...snapshot.rows[0]!.cells, [snapshot.board.primaryColumnId]: { kind: "text", value: "  " } },
    };

    expect(titleOf(blank, lenses)).toBe("Untitled record");
  });

  test("a status with no option selected has no label", async () => {
    const snapshot = await boardService.getBoard(ID.roadmap);
    const lenses = lensesFor(snapshot.board);

    const cleared: BoardRow = {
      ...snapshot.rows[0]!,
      cells: { ...snapshot.rows[0]!.cells, [lenses.status!.id]: { kind: "select", optionIds: [] } },
    };

    expect(statusOf(cleared, lenses).label).toBeNull();
  });
});

describe("routing a reference", () => {
  test("a record routes to its board", () => {
    const tree = buildTestTree();
    expect(hrefForRef(tree, recordRef())).toBe("/drive/development/backend/roadmap");
    expect(hrefForRef(tree, { kind: "document", nodeId: "missing", label: "Gone" })).toBe("/drive");
  });
});
