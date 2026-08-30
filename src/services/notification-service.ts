import { collabApi } from "@/services/api/collab.api";
import type { AppNotification } from "@/types";

export const notificationService = {
  list: async (signal?: AbortSignal): Promise<readonly AppNotification[]> =>
    (await collabApi.notifications({}, signal)).items,

  unreadCount: async (signal?: AbortSignal): Promise<number> =>
    (await collabApi.unreadCount(signal)).unreadCount,

  markRead: (notificationIds: readonly string[]) =>
    collabApi.markRead(notificationIds),

  markAllRead: () => collabApi.markAllRead(),
};
