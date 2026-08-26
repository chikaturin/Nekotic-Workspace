"use client";

import { AtSign, Bell, MessageSquare, UserPlus, Eye, type LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationReason } from "@/types";

const REASON_ICONS: Readonly<Record<NotificationReason, LucideIcon>> = {
  mention: AtSign,
  assigned: UserPlus,
  comment: MessageSquare,
  watch: Eye,
  system: Bell,
};

interface NotificationItemProps {
  readonly notification: AppNotification;
  readonly onOpen: (notification: AppNotification) => void;
  readonly isCompact?: boolean;
}

/**
 * One inbox row. Clicking it both marks it read and routes to its target, so
 * the two never diverge — an opened notification is a read notification.
 */
export function NotificationItem({
  notification,
  onOpen,
  isCompact = false,
}: NotificationItemProps) {
  const Icon = REASON_ICONS[notification.reason];
  const hasTarget = notification.target !== null;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border border-border bg-surface p-2.5 text-left transition-colors",
        hasTarget ? "hover:border-border-strong hover:bg-hover" : "cursor-default",
        !notification.isRead && "border-accent/30 bg-accent-soft/40",
      )}
    >
      <UserAvatar user={notification.actor} className={isCompact ? "size-6" : "size-7"} />

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-foreground">{notification.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] text-muted-foreground">
          {notification.body}
        </span>

        <span className="metric mt-1 flex items-center gap-1.5 text-[10px] text-faint-foreground">
          <Icon className="size-3" />
          {formatRelativeTime(notification.createdAt)}
          {notification.target && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{notification.target.label}</span>
            </>
          )}
        </span>
      </span>

      {!notification.isRead && (
        <Badge variant="count" className="mt-0.5 shrink-0 px-1.5">
          new
        </Badge>
      )}
    </button>
  );
}
