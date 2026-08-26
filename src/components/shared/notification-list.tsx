"use client";

import { AtSign, Bell, MessageSquare, Share2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { hrefForNode } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS, type NotificationKind } from "@/mock/notifications";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  mention: AtSign,
  share: Share2,
  comment: MessageSquare,
  system: Bell,
};

export function NotificationList() {
  const router = useRouter();
  const tree = useWorkspaceStore(selectTree);

  return (
    <ul className="mx-auto flex max-w-3xl flex-col gap-1.5">
      {NOTIFICATIONS.map((notification) => {
        const Icon = KIND_ICONS[notification.kind];
        const href = notification.nodeId ? hrefForNode(tree, notification.nodeId) : null;

        return (
          <li key={notification.id}>
            <button
              type="button"
              disabled={!href}
              onClick={() => href && router.push(href)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors",
                href ? "hover:border-border-strong hover:bg-hover" : "cursor-default",
                !notification.isRead && "border-accent/30",
              )}
            >
              <UserAvatar user={notification.actor} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-foreground">
                  <span className="font-medium">{notification.actor.name}</span>{" "}
                  <span className="text-muted-foreground">{notification.message}</span>
                </p>
                <p className="metric mt-1 flex items-center gap-1.5 text-[10px] text-faint-foreground">
                  <Icon className="size-3" />
                  {formatRelativeTime(notification.createdAt)}
                </p>
              </div>
              {!notification.isRead && <span className="mt-1.5 size-1.5 rounded-full bg-accent" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
