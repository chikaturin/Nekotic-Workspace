"use client";

import { cn } from "@/lib/utils";

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

/** Fields, conversation and history, one at a time — the drawer stays legible. */
export function DrawerTabs({ active, onChange }: DrawerTabsProps) {
  return (
    <div role="tablist" aria-label="Record sections" className="flex shrink-0 gap-0.5 border-b border-border px-3">
      {TABS.map((tab) => {
        const isActive = tab.id === active;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`drawer-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`drawer-panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] transition-colors",
              isActive
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
