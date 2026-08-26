"use client";

import { Bell, CheckCheck, RotateCcw } from "lucide-react";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { NotificationTabs } from "@/components/notifications/notification-tabs";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { formatCount } from "@/lib/format";

/** The full inbox — the same feed the bell shows, with room to read it. */
export function NotificationsPage() {
  const controller = useNotifications();

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Bell className="size-4 text-accent" />
        </span>

        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="metric text-[11px] text-faint-foreground">
            {formatCount(controller.unread, "unread item")} · {controller.all.length} total
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={controller.unread === 0}
            onClick={controller.markAllRead}
          >
            <CheckCheck />
            Mark all read
          </Button>
          <Button size="icon" variant="outline" aria-label="Reload" onClick={controller.refresh}>
            <RotateCcw />
          </Button>
        </div>

        <div className="w-full">
          <NotificationTabs
            tab={controller.tab}
            unreadPerTab={controller.unreadPerTab}
            onSelect={controller.setTab}
          />
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        <div className="mx-auto max-w-3xl">
          <NotificationFeed controller={controller} />
        </div>
      </div>
    </div>
  );
}
