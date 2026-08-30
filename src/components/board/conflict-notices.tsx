"use client";

import { TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBoardStore } from "@/store/board-store";
import type { ConflictNotice as Notice } from "@/types";

const AUTO_DISMISS_MS = 5000;

export function ConflictNotices() {
  const conflicts = useBoardStore((state) => state.conflicts);
  if (conflicts.length === 0) return null;

  return (
    <ul
      role="status"
      aria-live="polite"
      className="shrink-0 divide-y divide-hairline border-b border-warning/30 bg-warning/10"
    >
      {conflicts.map((conflict) => (
        <ConflictRow key={conflict.id} conflict={conflict} />
      ))}
    </ul>
  );
}

function ConflictRow({ conflict }: { readonly conflict: Notice }) {
  const dismissConflict = useBoardStore((state) => state.dismissConflict);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissConflict(conflict.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [conflict.id, dismissConflict]);

  return (
    <li className="flex items-center gap-2 px-4 py-1.5">
      <TriangleAlert className="size-3.5 shrink-0 text-warning" />
      <span className="min-w-0 flex-1 truncate text-ui text-foreground">{conflict.message}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Dismiss"
        onClick={() => dismissConflict(conflict.id)}
      >
        <X />
      </Button>
    </li>
  );
}
