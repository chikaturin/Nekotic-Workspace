"use client";

import { CircleCheck, CircleSlash } from "lucide-react";
import { formatCount } from "@/lib/format";
import type { ImportOutcome } from "@/types";

interface ImportResultStepProps {
  readonly outcome: ImportOutcome;
  readonly isSorted?: boolean;
}

export function ImportResultStep({ outcome, isSorted = false }: ImportResultStepProps) {
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

      {(outcome.removedColumns?.length ?? 0) > 0 && (
        <p className="mx-auto max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-body text-muted-foreground">
          Removed {formatCount(outcome.removedColumns!.length, "column")} the file had no data for:{" "}
          {outcome.removedColumns!.join(", ")}.
        </p>
      )}

      {hasCreated && isSorted && (
        <p className="mx-auto max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-body text-muted-foreground">
          They were imported in the file&rsquo;s row order. This view is sorted, so it is showing
          them in the sort&rsquo;s order instead — clear the sort to read the file&rsquo;s.
        </p>
      )}
    </div>
  );
}
