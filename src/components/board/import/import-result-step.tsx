"use client";

import { CircleCheck, CircleSlash } from "lucide-react";
import { formatCount } from "@/lib/format";
import type { ImportOutcome } from "@/types";

/** Step 4: what actually landed, and what did not. */
export function ImportResultStep({ outcome }: { outcome: ImportOutcome }) {
  const hasCreated = outcome.created > 0;

  return (
    <div className="space-y-4 px-5 py-8 text-center">
      <span
        className={`mx-auto flex size-14 items-center justify-center rounded-full ${
          hasCreated ? "bg-success/10" : "bg-hover"
        }`}
      >
        {hasCreated ? (
          <CircleCheck className="size-7 text-success" />
        ) : (
          <CircleSlash className="size-7 text-faint-foreground" />
        )}
      </span>

      <div>
        <p className="text-title font-semibold tracking-tight text-foreground">
          {hasCreated
            ? `Imported ${formatCount(outcome.created, "record")}`
            : "Nothing was imported"}
        </p>
        <p className="mt-1 text-ui text-muted-foreground">
          {outcome.skipped > 0
            ? `${formatCount(outcome.skipped, "row")} left out because of the values flagged in validation.`
            : "Every row in the file was written, and each record was given its own id by the board."}
        </p>
      </div>
    </div>
  );
}
