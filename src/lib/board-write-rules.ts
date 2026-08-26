import type { RowMap } from "@/lib/board-records";
import type { CellContext } from "@/lib/cell-values";
import { isConditionGroupEmpty } from "@/lib/conditions";
import { availabilityOf, resolveOptionAvailability } from "@/lib/select-availability";
import type { Board, CellEdit } from "@/types";

/**
 * The one gate every select write passes through.
 *
 * Transition rules and conditional options are *record* rules: they hold
 * wherever the value is written from — a Kanban drag, a cell editor, the
 * drawer, a paste. Enforcing them in one place is what stops the Kanban rule
 * being bypassable by opening the same record's Status cell in the table.
 *
 * This is not permission. Permission ("may this user edit Status at all") is
 * resolved separately by `can("row.update")` before anything reaches here, and
 * the two are never combined into a single boolean.
 */

export interface RejectedEdit {
  readonly edit: CellEdit;
  readonly message: string;
}

export interface GuardResult {
  readonly allowed: readonly CellEdit[];
  readonly rejected: readonly RejectedEdit[];
}

export interface GuardInput {
  readonly edits: readonly CellEdit[];
  readonly board: Board | null;
  readonly rowsById: RowMap;
  readonly context: CellContext;
}

/**
 * Split a batch into the edits that may be written and the ones that may not.
 *
 * Only select columns are gated, and only when they actually carry rules — a
 * board with no rules configured pays a `Map` lookup per edit and nothing else.
 */
export function guardCellEdits({ edits, board, rowsById, context }: GuardInput): GuardResult {
  if (!board || edits.length === 0) return { allowed: edits, rejected: [] };

  const columns = new Map(board.columns.map((column) => [column.id, column]));
  const allowed: CellEdit[] = [];
  const rejected: RejectedEdit[] = [];

  for (const edit of edits) {
    const column = columns.get(edit.columnId);
    const row = rowsById[edit.rowId];

    if (!column || column.type !== "select" || edit.value.kind !== "select" || !row) {
      allowed.push(edit);
      continue;
    }

    const hasRules =
      (column.config.transitionRules?.enabled ?? false) ||
      column.config.options.some(
        (option) => option.isDisabled || !isConditionGroupEmpty(option.availability),
      );

    if (!hasRules) {
      allowed.push(edit);
      continue;
    }

    const entries = resolveOptionAvailability({
      column,
      row,
      columns: board.columns,
      context,
    });

    // Clearing a status is always legal; only arriving somewhere is gated.
    const refusal = edit.value.optionIds
      .map((optionId) => availabilityOf(entries, optionId))
      .find((entry) => entry && !entry.isAvailable);

    if (refusal) {
      rejected.push({ edit, message: refusal.explanation });
      continue;
    }

    allowed.push(edit);
  }

  return { allowed, rejected };
}
