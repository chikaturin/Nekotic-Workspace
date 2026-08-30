"use client";

import { useEffect, useMemo } from "react";
import { filterByTab, unreadByTab } from "@/lib/notifications";
import { keepVisibleRefs } from "@/lib/permissions/visibility";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { selectNotifications, useNotificationStore } from "@/store/notification-store";
import { useSessionStore } from "@/store/session-store";
import type { AppError, AppNotification, NotificationTab } from "@/types";

export interface NotificationsController {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly error: AppError | null;
  readonly all: readonly AppNotification[];
  readonly visible: readonly AppNotification[];
  readonly tab: NotificationTab;
  readonly unread: number;
  readonly unreadPerTab: Readonly<Record<NotificationTab, number>>;
  readonly setTab: (tab: NotificationTab) => void;
  readonly markRead: (id: string) => void;
  readonly markAllRead: () => void;
  readonly refresh: () => void;
}

export function useNotifications(): NotificationsController {
  const sessionStatus = useSessionStore((state) => state.status);
  const status = useNotificationStore((state) => state.status);
  const error = useNotificationStore((state) => state.error);
  const tab = useNotificationStore((state) => state.tab);
  const delivered = useNotificationStore(selectNotifications);
  const tree = useWorkspaceStore(selectTree);

  const load = useNotificationStore((state) => state.load);
  const refresh = useNotificationStore((state) => state.refresh);
  const setTab = useNotificationStore((state) => state.setTab);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  useEffect(() => {
    if (sessionStatus !== "ready") return;
    void load();
  }, [sessionStatus, load]);

  const all = useMemo(
    () =>
      keepVisibleRefs(delivered, tree, (item) => item.target?.nodeId ?? "").concat(
        delivered.filter((item) => item.target === null),
      ),
    [delivered, tree],
  );

  const unread = useMemo(() => all.filter((item) => !item.isRead).length, [all]);
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
