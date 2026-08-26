import type { AppNotification, NotificationReason, NotificationTab } from "@/types";

/**
 * Inbox tabs are a projection of `reason`, not a second field on the record —
 * one notification can never disagree with the tab it lands in.
 */
const TAB_REASONS: Readonly<Record<NotificationTab, readonly NotificationReason[] | null>> = {
  all: null,
  mentions: ["mention"],
  assigned: ["assigned"],
  // Following covers everything you get because you watch the target.
  following: ["watch", "comment"],
};

export interface NotificationTabDefinition {
  readonly id: NotificationTab;
  readonly label: string;
}

export const NOTIFICATION_TABS: readonly NotificationTabDefinition[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "assigned", label: "Assigned" },
  { id: "following", label: "Following" },
] as const;

export function matchesTab(notification: AppNotification, tab: NotificationTab): boolean {
  const reasons = TAB_REASONS[tab];
  return reasons === null || reasons.includes(notification.reason);
}

export function filterByTab(
  notifications: readonly AppNotification[],
  tab: NotificationTab,
): readonly AppNotification[] {
  return tab === "all" ? notifications : notifications.filter((item) => matchesTab(item, tab));
}

export function countUnread(notifications: readonly AppNotification[]): number {
  return notifications.reduce((total, item) => (item.isRead ? total : total + 1), 0);
}

/** Unread badge per tab, computed in one pass over the inbox. */
export function unreadByTab(
  notifications: readonly AppNotification[],
): Readonly<Record<NotificationTab, number>> {
  const counts: Record<NotificationTab, number> = {
    all: 0,
    mentions: 0,
    assigned: 0,
    following: 0,
  };

  for (const notification of notifications) {
    if (notification.isRead) continue;
    for (const { id } of NOTIFICATION_TABS) {
      if (matchesTab(notification, id)) counts[id] += 1;
    }
  }

  return counts;
}

/**
 * Mark a set of ids read. Immutable, and the array identity is preserved when
 * nothing actually changed so subscribers do not re-render.
 */
export function markRead(
  notifications: readonly AppNotification[],
  ids: readonly string[],
): readonly AppNotification[] {
  const targets = new Set(ids);
  let changed = false;

  const next = notifications.map((notification) => {
    if (notification.isRead || !targets.has(notification.id)) return notification;
    changed = true;
    return { ...notification, isRead: true };
  });

  return changed ? next : notifications;
}

export function markAllRead(
  notifications: readonly AppNotification[],
): readonly AppNotification[] {
  return markRead(
    notifications,
    notifications.map((notification) => notification.id),
  );
}

/** Newest first, then insert or replace by id — the realtime ingest path. */
export function upsertNotification(
  notifications: readonly AppNotification[],
  incoming: AppNotification,
): readonly AppNotification[] {
  const index = notifications.findIndex((item) => item.id === incoming.id);

  if (index >= 0) {
    if (notifications[index] === incoming) return notifications;
    const next = [...notifications];
    next[index] = incoming;
    return next;
  }

  return [incoming, ...notifications].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
