import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  countUnread,
  markAllRead,
  markRead,
  unreadByTab,
  upsertNotification,
} from "@/lib/notifications";
import { createRealtimeClient } from "@/lib/realtime/client";
import { createLocalTransport, createTransport } from "@/lib/realtime/transport";
import { CURRENT_USER, directoryAt } from "@/mock/users";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useNotificationStore } from "@/store/notification-store";
import type { AppNotification, RealtimeEvent } from "@/types";
import { collabFake } from "./msw/fake/collab.fake";

function notification(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    reason: "mention",
    recipientId: CURRENT_USER.id,
    actor: directoryAt(1),
    title: `Notification ${id}`,
    body: "body",
    target: null,
    createdAt: "2026-08-26T09:00:00.000Z",
    isRead: false,
    ...overrides,
  };
}

function frame(id: string, payload: RealtimeEvent["payload"]): RealtimeEvent {
  return { id, at: "2026-08-26T09:00:00.000Z", origin: "remote", payload };
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
});

describe("transport", () => {
  test("a closed transport delivers nothing", () => {
    const transport = createLocalTransport();
    const handler = vi.fn();
    transport.subscribe(handler);

    transport.publish(frame("e1", { type: "notification.read", notificationIds: [] }));
    expect(handler).not.toHaveBeenCalled();
    expect(transport.status).toBe("idle");

    transport.connect();
    transport.publish(frame("e2", { type: "notification.read", notificationIds: [] }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(transport.status).toBe("open");
  });

  test("unsubscribing stops delivery", () => {
    const transport = createLocalTransport();
    transport.connect();

    const handler = vi.fn();
    const unsubscribe = transport.subscribe(handler);
    unsubscribe();

    transport.publish(frame("e1", { type: "notification.read", notificationIds: [] }));
    expect(handler).not.toHaveBeenCalled();
  });

  test("the local bus is what ships while the backend has no endpoint", () => {
    expect(createTransport().name).toBe("local");
  });
});

describe("realtime client", () => {
  test("an event id is delivered exactly once", () => {
    const transport = createLocalTransport();
    const client = createRealtimeClient(transport);
    client.connect();

    const handler = vi.fn();
    client.subscribe(handler);

    const event = frame("evt_same", { type: "notification.read", notificationIds: ["n1"] });

    // Two deliveries of the same frame — a reconnect replay, or a server echo
    // of a write this tab already applied optimistically.
    transport.publish(event);
    transport.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(client.duplicatesDropped).toBe(1);
    expect(client.transportName).toBe("local");
  });

  test("emitting locally travels the same path as a remote frame", () => {
    const client = createRealtimeClient(createLocalTransport());
    client.connect();

    const seen: RealtimeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    const sent = client.emit({ type: "notification.read", notificationIds: ["n1"] });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.id).toBe(sent.id);
    expect(seen[0]?.origin).toBe("local");
  });
});

describe("inbox state", () => {
  test("the same notification twice stays one row and one unread", () => {
    const store = useNotificationStore.getState();
    const incoming = notification("ntf_1");

    store.ingest(frame("e1", { type: "notification.created", notification: incoming }));
    store.ingest(frame("e2", { type: "notification.created", notification: incoming }));

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(countUnread(state.notifications)).toBe(1);
    // A frame arriving before the first load still fills the inbox.
    expect(state.status).toBe("ready");
  });

  test("another inbox's notification is ignored", () => {
    useNotificationStore
      .getState()
      .ingest(
        frame("e1", {
          type: "notification.created",
          notification: notification("ntf_other", { recipientId: "usr_mai" }),
        }),
      );

    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  test("a read frame clears the unread flag without reordering", () => {
    const store = useNotificationStore.getState();
    store.ingest(
      frame("e1", {
        type: "notification.created",
        notification: notification("a", { createdAt: "2026-08-26T08:00:00.000Z" }),
      }),
    );
    store.ingest(
      frame("e2", {
        type: "notification.created",
        notification: notification("b", { createdAt: "2026-08-26T09:00:00.000Z" }),
      }),
    );

    expect(useNotificationStore.getState().notifications.map((item) => item.id)).toEqual(["b", "a"]);

    store.ingest(frame("e3", { type: "notification.read", notificationIds: ["a"] }));
    const after = useNotificationStore.getState().notifications;

    expect(after.map((item) => item.id)).toEqual(["b", "a"]);
    expect(countUnread(after)).toBe(1);
  });

  test("service writes reach the store through the shared client", async () => {
    collabFake.emitForTest({
      reason: "assigned",
      recipientId: CURRENT_USER.id,
      actor: directoryAt(2),
      title: "Duc Pham assigned you TASK-004",
      body: "",
      target: null,
    });

    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });
});

describe("inbox maths", () => {
  test("tabs project the reason, and count their own unread", () => {
    const inbox = [
      notification("a", { reason: "mention" }),
      notification("b", { reason: "assigned" }),
      notification("c", { reason: "comment" }),
      notification("d", { reason: "watch", isRead: true }),
      notification("e", { reason: "system" }),
    ];

    const counts = unreadByTab(inbox);
    expect(counts.all).toBe(4);
    expect(counts.mentions).toBe(1);
    expect(counts.assigned).toBe(1);
    // Following covers watch and comment; the watch one here is already read.
    expect(counts.following).toBe(1);
  });

  test("marking read preserves identity when nothing changes", () => {
    const inbox = [notification("a", { isRead: true })];

    expect(markRead(inbox, ["a"])).toBe(inbox);
    expect(markRead(inbox, ["missing"])).toBe(inbox);
    expect(markAllRead(inbox)).toBe(inbox);
    expect(countUnread(markAllRead([notification("b")]))).toBe(0);
  });

  test("upsert keeps the inbox newest first", () => {
    const older = notification("a", { createdAt: "2026-08-26T08:00:00.000Z" });
    const newer = notification("b", { createdAt: "2026-08-26T09:00:00.000Z" });

    const inbox = upsertNotification(upsertNotification([], older), newer);
    expect(inbox.map((item) => item.id)).toEqual(["b", "a"]);

    // Re-applying an unchanged entry keeps the array identity.
    expect(upsertNotification(inbox, older)).toBe(inbox);
    expect(upsertNotification(inbox, { ...older, isRead: true })).toHaveLength(2);
  });
});
