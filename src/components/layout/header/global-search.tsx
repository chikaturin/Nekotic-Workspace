"use client";

import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useMounted } from "@/hooks/use-mounted";
import { useWorkspaceStore } from "@/store/workspace-store";

/** Header affordance that opens the ⌘K palette. */
export function GlobalSearch() {
  const setSearchOpen = useWorkspaceStore((state) => state.setSearchOpen);
  const isMounted = useMounted();
  const isMac = isMounted && navigator.platform.toLowerCase().includes("mac");

  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="group flex h-8 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-canvas px-2.5 text-left text-sm text-faint-foreground outline-none transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Search className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Search workspace…</span>
      <span className="flex shrink-0 items-center gap-1">
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
