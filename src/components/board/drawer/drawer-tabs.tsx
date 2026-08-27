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

/**
 * Fields, conversation and history, one at a time — the drawer stays legible.
 *
 * The strip itself is `Tabs`, which is where the arrow keys and the roving
 * tabindex now live; this file used to be a hand-rolled tablist with neither,
 * so reaching Activity from the keyboard meant three separate tab stops. The
 * panels stay behind in the drawer, mounted, which is why the triggers are
 * pointed at them by hand below rather than wrapped in `TabsContent`.
 */
export function DrawerTabs({ active, onChange }: DrawerTabsProps) {
  return (
    <Tabs
      variant="underline"
      value={active}
      onValueChange={(value) => {
        // Looked up rather than asserted: the strip is built from TABS, so the
        // value always is one of them, and a lookup cannot quietly start lying
        // about that the way a cast would if a tab were ever added elsewhere.
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
            // The drawer keeps all three panels mounted so switching to the
            // history and back never costs a half-typed comment, which means
            // they are its own markup rather than `TabsContent` and carry
            // their own stable ids. The generated pair would point at nothing.
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
