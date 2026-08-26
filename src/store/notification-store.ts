"use client";

import { create } from "zustand";
import { countUnread, markRead as markReadLocally, upsertNotification } from "@/lib/notifications";
import { realtime } from "@/lib/realtime/client";
import { CURRENT_USER } from "@/mock/users";
import { notificationService } from "@/services/notification-service";
import { isCancellation, toAppError } from "@/services/errors";
import type { AppError, AppNotification, NotificationTab, RealtimeEvent } from "@/types";

/**
 * Notification inbox (CO-NOT-29).
 *
 * Realtime frames land here through `ingest`, which upserts by id. That is the
 * guarantee against double-counting: a notification this tab created
 * optimistically, echoed back by the transport, replaces itself instead of
 * appearing twice — and the unread badge is derived, never incremented.
 */

type Status = "idle" | "loading" | "ready" | "error";

interface NotificationState {
  readonly status: Status;
  readonly error: AppError | null;
  readonly notifications: readonly AppNotification[];
  readonly tab: NotificationTab;
  readonly isPanelOpen: boolean;
}

interface NotificationActions {
  /** Loads once; later callers are no-ops until `refresh` asks for a re-read. */
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setTab: (tab: NotificationTab) => void;
  setPanelOpen: (open: boolean) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Apply one realtime frame. Idempotent by construction. */
  ingest: (event: RealtimeEvent) => void;
}

export type NotificationStore = NotificationState & NotificationActions;

const INITIAL: NotificationState = {
  status: "idle",
  error: null,
  notifications: [],
  tab: "all",
  isPanelOpen: false,
};

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  ...INITIAL,

  load: async () => {
    if (get().status !== "idle") return;
    await get().refresh();
  },

  refresh: async () => {
    set({ status: "loading", error: null });

    try {
      const notifications = await notificationService.list(CURRENT_USER.id);
      set({ status: "ready", notifications, error: null });
    } catch (error) {
      const appError = toAppError(error);
      if (isCancellation(appError)) return;
      set({ status: "error", error: appError });
    }
  },

  setTab: (tab) => set({ tab }),
  setPanelOpen: (isPanelOpen) => set({ isPanelOpen }),

  markRead: async (id) => {
    const before = get().notifications;
    if (before.find((item) => item.id === id)?.isRead !== false) return;

    // Optimistic: the badge drops on click, not on the round trip.
    set({ notifications: markReadLocally(before, [id]) });

    try {
      set({ notifications: await notificationService.markRead([id], CURRENT_USER.id) });
    } catch {
      set({ notifications: before });
    }
  },

  markAllRead: async () => {
    const before = get().notifications;
    if (countUnread(before) === 0) return;

    set({
      notifications: markReadLocally(
        before,
        before.map((item) => item.id),
      ),
    });

    try {
      set({ notifications: await notificationService.markAllRead(CURRENT_USER.id) });
    } catch {
      set({ notifications: before });
    }
  },

  ingest: (event) => {
    const { payload } = event;

    if (payload.type === "notification.created") {
      if (payload.notification.recipientId !== CURRENT_USER.id) return;
      set((state) => ({
        notifications: upsertNotification(state.notifications, payload.notification),
        // A frame that arrives before the first load still populates the inbox.
        status: state.status === "idle" ? "ready" : state.status,
      }));
      return;
    }

    if (payload.type === "notification.read") {
      set((state) => ({
        notifications: markReadLocally(state.notifications, payload.notificationIds),
      }));
    }
  },
}));

// One subscription for the whole app; the client drops repeated event ids.
realtime.subscribe((event) => useNotificationStore.getState().ingest(event));

/* -------------------------------------------------------------- selectors */

/**
 * Only scalar and stored-reference selectors live here. Anything derived that
 * allocates — the per-tab list, the per-tab counts — is memoised in the hook,
 * because a selector that returns a fresh array on every read would make
 * `useSyncExternalStore` re-render forever.
 */
export const selectUnreadCount = (state: NotificationStore): number =>
  countUnread(state.notifications);

export const selectNotifications = (state: NotificationStore): readonly AppNotification[] =>
  state.notifications;
