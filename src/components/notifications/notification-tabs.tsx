"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NOTIFICATION_TABS } from "@/lib/notifications";
import type { NotificationTab } from "@/types";

interface NotificationTabsProps {
  readonly tab: NotificationTab;
  readonly unreadPerTab: Readonly<Record<NotificationTab, number>>;
  readonly onSelect: (tab: NotificationTab) => void;
}

/**
 * All · Mentions · Assigned · Following, each carrying its own unread count.
 *
 * The pill variant is the skin this strip already wore; what it gains from
 * `Tabs` is the keyboard — arrow keys across the filters and one tab stop for
 * the group, where before every filter was its own stop on the way to the feed.
 */
export function NotificationTabs({ tab, unreadPerTab, onSelect }: NotificationTabsProps) {
  return (
    <Tabs
      variant="pill"
      value={tab}
      onValueChange={(value) => {
        // The definitions are the only source of tab ids, so matching against
        // them narrows the string back to a NotificationTab without a cast.
        const definition = NOTIFICATION_TABS.find((entry) => entry.id === value);
        if (definition) onSelect(definition.id);
      }}
    >
      <TabsList aria-label="Notification filters">
        {NOTIFICATION_TABS.map((definition) => (
          <TabsTrigger
            key={definition.id}
            value={definition.id}
            count={unreadPerTab[definition.id]}
            // Both call sites — the bell popover and the full inbox — render
            // the feed as a plain sibling rather than as a labelled panel, so
            // there is no element for the trigger to control. A generated id
            // pointing at nothing is worse than no id at all.
            aria-controls={undefined}
          >
            {definition.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
