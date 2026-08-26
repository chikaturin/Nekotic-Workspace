"use client";

import { useEffect, useMemo } from "react";
import { filterByTab, unreadByTab } from "@/lib/notifications";
import {
  selectNotifications,
  selectUnreadCount,
  useNotificationStore,
} from "@/store/notification-store";
import type { AppError, AppNotification, NotificationTab } from "@/types";

export interface NotificationsController {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly error: AppError | null;
  readonly all: readonly AppNotification[];
  /** The active tab's slice. */
  readonly visible: readonly AppNotification[];
  readonly tab: NotificationTab;
  readonly unread: number;
  readonly unreadPerTab: Readonly<Record<NotificationTab, number>>;
  readonly setTab: (tab: NotificationTab) => void;
  readonly markRead: (id: string) => void;
  readonly markAllRead: () => void;
  readonly refresh: () => void;
}

/**
 * The inbox, as the bell and the notifications page both read it.
 *
 * Derived slices are memoised here rather than in a store selector: a selector
 * that allocates a fresh array per read would break `useSyncExternalStore`'s
 * snapshot comparison.
 */
export function useNotifications(): NotificationsController {
  const status = useNotificationStore((state) => state.status);
  const error = useNotificationStore((state) => state.error);
  const tab = useNotificationStore((state) => state.tab);
  const all = useNotificationStore(selectNotifications);
  const unread = useNotificationStore(selectUnreadCount);

  const load = useNotificationStore((state) => state.load);
  const refresh = useNotificationStore((state) => state.refresh);
  const setTab = useNotificationStore((state) => state.setTab);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => filterByTab(all, tab), [all, tab]);
  const unreadPerTab = useMemo(() => unreadByTab(all), [all]);

  return {
    status,
    error,
    all,
    visible,
    tab,
    unread,
    unreadPerTab,
    setTab,
    markRead: (id) => void markRead(id),
    markAllRead: () => void markAllRead(),
    refresh: () => void refresh(),
  };
}
