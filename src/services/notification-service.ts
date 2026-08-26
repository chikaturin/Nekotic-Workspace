import { realtime } from "@/lib/realtime/client";
import { markRead as markSome } from "@/lib/notifications";
import { seedNotifications } from "@/mock/collab";
import { CURRENT_USER } from "@/mock/users";
import { nextId, nowIso, readDelay, writeDelay } from "@/services/backend";
import type { AppNotification, EntityRef, NotificationReason, UserSummary } from "@/types";

/**
 * Notification inbox (CO-NOT-29).
 *
 * Notifications are addressed to a recipient, so `list` can only ever return
 * the signed-in user's. Everything that creates one goes through `emit`, which
 * also publishes the realtime frame — there is no second path that could put a
 * notification on screen without the inbox knowing about it.
 */

let store: AppNotification[] | null = null;

function catalog(): AppNotification[] {
  if (!store) store = [...seedNotifications()];
  return store;
}

function newestFirst(a: AppNotification, b: AppNotification): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

async function list(userId: string, signal?: AbortSignal): Promise<readonly AppNotification[]> {
  await readDelay(signal);
  return catalog()
    .filter((notification) => notification.recipientId === userId)
    .sort(newestFirst);
}

/** Ids outside the caller's own inbox are ignored, not applied. */
async function markRead(
  ids: readonly string[],
  userId: string,
  signal?: AbortSignal,
): Promise<readonly AppNotification[]> {
  await writeDelay(signal);

  const owned = new Set(
    catalog()
      .filter((notification) => notification.recipientId === userId)
      .map((notification) => notification.id),
  );
  const scoped = ids.filter((id) => owned.has(id));

  store = [...markSome(catalog(), scoped)];
  realtime.emit({ type: "notification.read", notificationIds: scoped });

  return catalog().filter((notification) => notification.recipientId === userId).sort(newestFirst);
}

/** Mark every unread notification in one inbox read, and nobody else's. */
async function markAllRead(
  userId: string,
  signal?: AbortSignal,
): Promise<readonly AppNotification[]> {
  await writeDelay(signal);

  const ids = catalog()
    .filter((notification) => notification.recipientId === userId && !notification.isRead)
    .map((notification) => notification.id);

  store = [...markSome(catalog(), ids)];
  realtime.emit({ type: "notification.read", notificationIds: ids });

  return catalog().filter((notification) => notification.recipientId === userId).sort(newestFirst);
}

export interface EmitInput {
  readonly reason: NotificationReason;
  readonly recipientId: string;
  readonly actor: UserSummary;
  readonly title: string;
  readonly body: string;
  readonly target: EntityRef | null;
}

/**
 * Create one notification and announce it.
 *
 * Synchronous on purpose: it runs inside another write (posting a comment),
 * where a second round trip would only make the fan-out partially applied.
 */
function emit({ reason, recipientId, actor, title, body, target }: EmitInput): AppNotification {
  const notification: AppNotification = {
    id: nextId("ntf"),
    reason,
    recipientId,
    actor,
    title,
    body,
    target,
    createdAt: nowIso(),
    isRead: false,
  };

  catalog().unshift(notification);

  // The inbox hears about it the same way a remote change would.
  if (recipientId === CURRENT_USER.id) {
    realtime.emit({ type: "notification.created", notification });
  }

  return notification;
}

/** Test seam. */
function reset(): void {
  store = null;
}

export const notificationService = { list, markRead, markAllRead, emit, reset };
