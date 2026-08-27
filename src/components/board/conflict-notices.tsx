"use client";

import { TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBoardStore } from "@/store/board-store";
import type { ConflictNotice as Notice } from "@/types";

/**
 * How long a conflict notice stays up.
 *
 * Longer than the feedback toast, because this one is about somebody else's
 * write landing on a record you were editing and is worth actually reading —
 * and short, because it is news, not a task. Nothing is lost when it goes: the
 * edit it is reporting on has already been resolved by the time the line
 * appears, and the record itself carries the result.
 */
const AUTO_DISMISS_MS = 5000;

/**
 * "QA-005 changed elsewhere — your edit was kept".
 *
 * A strip above the grid rather than a toast: several can land at once from a
 * single save, and a toast surface that holds one message would show the last
 * and drop the rest.
 */
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

/**
 * One notice, with its own timer.
 *
 * Per row rather than one effect over the list, and that is the whole reason
 * this is a component: the list's identity changes every time any notice is
 * dismissed, so a single effect would restart the countdown for every
 * survivor — dismiss one at four seconds and the others quietly get five more.
 * Keyed on its own id, each line goes exactly five seconds after it arrived.
 */
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
