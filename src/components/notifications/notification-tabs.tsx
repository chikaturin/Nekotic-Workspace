"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NOTIFICATION_TABS } from "@/lib/notifications";
import type { NotificationTab } from "@/types";

interface NotificationTabsProps {
  readonly tab: NotificationTab;
  readonly unreadPerTab: Readonly<Record<NotificationTab, number>>;
  readonly onSelect: (tab: NotificationTab) => void;
}

export function NotificationTabs({ tab, unreadPerTab, onSelect }: NotificationTabsProps) {
  return (
    <Tabs
      variant="pill"
      value={tab}
      onValueChange={(value) => {
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
            aria-controls={undefined}
          >
            {definition.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
