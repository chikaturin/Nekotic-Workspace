"use client";

import { create } from "zustand";
import { countUnread, markRead as markReadLocally, upsertNotification } from "@/lib/notifications";
import { realtime } from "@/lib/realtime/client";
import { notificationService } from "@/services/notification-service";
import { isCancellation, toAppError } from "@/services/errors";
import type { AppError, AppNotification, NotificationTab, RealtimeEvent } from "@/types";
import { currentUser } from "@/store/session-store";

type Status = "idle" | "loading" | "ready" | "error";

interface NotificationState {
  readonly status: Status;
  readonly error: AppError | null;
  readonly notifications: readonly AppNotification[];
  readonly tab: NotificationTab;
  readonly isPanelOpen: boolean;
}

interface NotificationActions {
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setTab: (tab: NotificationTab) => void;
  setPanelOpen: (open: boolean) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
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
      const notifications = await notificationService.list();
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

    set({ notifications: markReadLocally(before, [id]) });

    try {
      await notificationService.markRead([id]);
      set({ notifications: await notificationService.list() });
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
      await notificationService.markAllRead();
      set({ notifications: await notificationService.list() });
    } catch {
      set({ notifications: before });
    }
  },

  ingest: (event) => {
    const { payload } = event;

    if (payload.type === "notification.created") {
      if (payload.notification.recipientId !== currentUser().id) return;
      set((state) => ({
        notifications: upsertNotification(state.notifications, payload.notification),
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

realtime.subscribe((event) => useNotificationStore.getState().ingest(event));

export const selectUnreadCount = (state: NotificationStore): number =>
  countUnread(state.notifications);

export const selectNotifications = (state: NotificationStore): readonly AppNotification[] =>
  state.notifications;
