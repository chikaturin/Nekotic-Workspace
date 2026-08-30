"use client";

import { BellOff } from "lucide-react";
import { NotificationItem } from "@/components/notifications/notification-item";
import { ErrorState, ListLoadingState, StatePanel } from "@/components/shared/state-panels";
import { useNotifications } from "@/hooks/use-notifications";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import type { AppNotification } from "@/types";

interface NotificationFeedProps {
  readonly controller: ReturnType<typeof useNotifications>;
  readonly isCompact?: boolean;
  readonly onOpened?: () => void;
}

export function NotificationFeed({
  controller,
  isCompact = false,
  onOpened,
}: NotificationFeedProps) {
  const openEntity = useOpenEntity();

  function open(notification: AppNotification) {
    controller.markRead(notification.id);

    if (notification.target) {
      openEntity(notification.target);
      onOpened?.();
    }
  }

  if (controller.status === "loading" || controller.status === "idle") {
    return <ListLoadingState rows={isCompact ? 3 : 5} />;
  }

  if (controller.status === "error" && controller.error) {
    return <ErrorState error={controller.error} onRetry={controller.refresh} />;
  }

  if (controller.visible.length === 0) {
    return (
      <StatePanel
        icon={BellOff}
        title="Nothing here"
        description={
          controller.tab === "following"
            ? "Watch a record, a page or a board to see its activity in this tab."
            : "New activity lands here as it happens."
        }
        className="min-h-[160px]"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {controller.visible.map((notification) => (
        <li key={notification.id}>
          <NotificationItem
            notification={notification}
            onOpen={open}
            isCompact={isCompact}
          />
        </li>
      ))}
    </ul>
  );
}
