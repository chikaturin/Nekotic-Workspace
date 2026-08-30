"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { NotificationTabs } from "@/components/notifications/notification-tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";
import { useNotificationStore } from "@/store/notification-store";
import { formatCount } from "@/lib/format";

export function NotificationBell() {
  const controller = useNotifications();
  const isOpen = useNotificationStore((state) => state.isPanelOpen);
  const setPanelOpen = useNotificationStore((state) => state.setPanelOpen);

  return (
    <Popover open={isOpen} onOpenChange={setPanelOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          aria-label={`Notifications, ${formatCount(controller.unread, "unread item")}`}
        >
          <Bell />
          {controller.unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-micro font-semibold leading-4 text-accent-foreground ring-2 ring-surface">
              {controller.unread > 9 ? "9+" : controller.unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[380px] p-0">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-lead font-semibold text-foreground">Notifications</span>
          <span className="metric text-micro text-faint-foreground">
            {controller.unread} unread
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 gap-1.5 px-2 text-body"
            disabled={controller.unread === 0}
            onClick={controller.markAllRead}
          >
            <CheckCheck />
            Mark all read
          </Button>
        </header>

        <div className="border-b border-border px-2 py-1.5">
          <NotificationTabs
            tab={controller.tab}
            unreadPerTab={controller.unreadPerTab}
            onSelect={controller.setTab}
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          <NotificationFeed
            controller={controller}
            isCompact
            onOpened={() => setPanelOpen(false)}
          />
        </div>

        <footer className="border-t border-border p-1.5">
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="w-full justify-center text-body"
            onClick={() => setPanelOpen(false)}
          >
            <Link href="/notifications">Open the full inbox</Link>
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
