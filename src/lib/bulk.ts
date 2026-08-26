import { isRowArchived } from "@/lib/archive";
import { formatCount } from "@/lib/format";
import type { BoardRow, BulkResult, BulkSkip, BulkSkipReason } from "@/types";

/**
 * Bulk writes (SY-BLK-34).
 *
 * A bulk action is one request, not a loop of single-row calls — so the answer
 * has to carry partial success. Splitting the requested ids into "written" and
 * "left alone, because…" happens here, in one place, and every action reports
 * through the same shape.
 */

export const BULK_SKIP_LABELS: Readonly<Record<BulkSkipReason, string>> = {
  archived: "archived",
  not_found: "no longer on this board",
};

export interface BulkPartition {
  readonly targets: readonly BoardRow[];
  readonly skipped: readonly BulkSkip[];
}

export interface PartitionOptions {
  /** Restoring is the one write an archived record must still accept. */
  readonly allowArchived?: boolean;
}

/** Split requested ids into the records a write may touch and the rest. */
export function partitionBulkTargets(
  rowIds: readonly string[],
  lookup: (rowId: string) => BoardRow | undefined,
  { allowArchived = false }: PartitionOptions = {},
): BulkPartition {
  const targets: BoardRow[] = [];
  const skipped: BulkSkip[] = [];

  for (const rowId of rowIds) {
    const row = lookup(rowId);

    if (!row) {
      skipped.push({ rowId, displayId: rowId, reason: "not_found" });
      continue;
    }

    if (!allowArchived && isRowArchived(row)) {
      skipped.push({ rowId, displayId: row.displayId, reason: "archived" });
      continue;
    }

    targets.push(row);
  }

  return { targets, skipped };
}

/**
 * `Updated 97 records · 3 skipped (archived)` — the sentence the toast shows.
 * Skips are never folded into the success count, and never dropped from it.
 */
export function describeBulkResult(result: BulkResult, verb: string): string {
  const applied = `${verb} ${formatCount(result.applied.length, "record")}`;
  if (result.skipped.length === 0) return applied;

  const reasons = [...new Set(result.skipped.map((skip) => BULK_SKIP_LABELS[skip.reason]))];
  return `${applied} · ${result.skipped.length} skipped (${reasons.join(", ")})`;
}

/** Tone for the feedback toast: a clean run reads as success, a partial one not. */
export function bulkTone(result: BulkResult): "success" | "info" | "error" {
  if (result.applied.length === 0) return "error";
  return result.skipped.length === 0 ? "success" : "info";
}
