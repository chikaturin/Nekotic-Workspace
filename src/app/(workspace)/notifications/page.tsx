import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { NotificationList } from "@/components/shared/notification-list";
import { UNREAD_COUNT } from "@/mock/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Bell className="size-4 text-accent" />
        </span>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="metric text-[11px] text-faint-foreground">{UNREAD_COUNT} unread</p>
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        <NotificationList />
      </div>
    </div>
  );
}
