"use client";

import { NOTIFICATION_TABS } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { NotificationTab } from "@/types";

interface NotificationTabsProps {
  readonly tab: NotificationTab;
  readonly unreadPerTab: Readonly<Record<NotificationTab, number>>;
  readonly onSelect: (tab: NotificationTab) => void;
}

/** All · Mentions · Assigned · Following, each carrying its own unread count. */
export function NotificationTabs({ tab, unreadPerTab, onSelect }: NotificationTabsProps) {
  return (
    <div role="tablist" aria-label="Notification filters" className="flex items-center gap-0.5">
      {NOTIFICATION_TABS.map((definition) => {
        const isActive = definition.id === tab;
        const unread = unreadPerTab[definition.id];

        return (
          <button
            key={definition.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(definition.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-ui transition-colors",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            {definition.label}
            {unread > 0 && (
              <span
                className={cn(
                  "metric rounded-full px-1 text-micro",
                  isActive ? "bg-accent text-accent-foreground" : "bg-hover text-faint-foreground",
                )}
              >
                {unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
