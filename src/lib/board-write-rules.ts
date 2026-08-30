import type { RowMap } from "@/lib/board-records";
import type { CellContext } from "@/lib/cell-values";
import { isConditionGroupEmpty } from "@/lib/conditions";
import { availabilityOf, resolveOptionAvailability } from "@/lib/select-availability";
import type { Board, CellEdit } from "@/types";

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
