"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type DrawerTabId = "details" | "comments" | "activity";

interface DrawerTabsProps {
  readonly active: DrawerTabId;
  readonly onChange: (tab: DrawerTabId) => void;
}

const TABS: readonly { readonly id: DrawerTabId; readonly label: string }[] = [
  { id: "details", label: "Details" },
  { id: "comments", label: "Comments" },
  { id: "activity", label: "Activity" },
];

export function DrawerTabs({ active, onChange }: DrawerTabsProps) {
  return (
    <Tabs
      variant="underline"
      value={active}
      onValueChange={(value) => {
        const tab = TABS.find((entry) => entry.id === value);
        if (tab) onChange(tab.id);
      }}
      className="shrink-0"
    >
      <TabsList aria-label="Record sections">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            id={`drawer-tab-${tab.id}`}
            aria-controls={`drawer-panel-${tab.id}`}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
