import type { CellContext } from "@/lib/cell-values";
import {
  describeConditionGroup,
  evaluateConditionGroup,
  isConditionGroupEmpty,
  type ConditionScope,
} from "@/lib/conditions";
import { evaluateTransition, transitionKeyOf, EMPTY_OPTION_KEY } from "@/lib/transition-rules";
import type {
  BoardColumn,
  BoardColumnOf,
  BoardRow,
  CellValue,
  SelectOption,
  UnavailableOptionBehavior,
} from "@/types";

/**
 * Which options a record may actually be given.
 *
 * Three separate gates, resolved in one place so the cell editor, the drawer
 * field and the Kanban drop all agree:
 *
 *   1. the option is switched off in column settings,
 *   2. its conditions do not hold for this record,
 *   3. a transition rule forbids moving here from where the record is now.
 *
 * None of them is permission — "may this user edit Status at all" is answered
 * before any of this, by `can("row.update")`.
 */

export type UnavailableReason = "disabled" | "condition" | "transition";

export interface OptionAvailability {
  readonly option: SelectOption;
  readonly isAvailable: boolean;
  readonly reason: UnavailableReason | null;
  /** One line explaining the refusal — what the lock row shows. */
  readonly explanation: string;
}

export interface AvailabilityInput {
  readonly column: BoardColumnOf<"select">;
  readonly row: BoardRow | null;
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  /**
   * Skip the transition gate. The rule-config UI and bulk edits ask for the
   * option catalogue itself, not for one record's next legal move.
   */
  readonly ignoreTransitions?: boolean;
}

const AVAILABLE = { isAvailable: true, reason: null, explanation: "" } as const;

/** The option ids the record currently holds, as a transition source key. */
function currentKey(row: BoardRow | null, column: BoardColumnOf<"select">): string {
  const value: CellValue | undefined = row?.cells[column.id];
  if (!value || value.kind !== "select") return EMPTY_OPTION_KEY;

  return transitionKeyOf(value.optionIds[0] ?? EMPTY_OPTION_KEY);
}

/**
 * Every option with its verdict, in column order. Returning all of them —
 * rather than the available ones — is what lets the dropdown choose between
 * hiding and disabling without asking twice.
 */
export function resolveOptionAvailability({
  column,
  row,
  columns,
  context,
  ignoreTransitions = false,
}: AvailabilityInput): readonly OptionAvailability[] {
  const scope: ConditionScope | null = row
    ? { row, columns: new Map(columns.map((item) => [item.id, item])), context }
    : null;

  const from = currentKey(row, column);

  return column.config.options.map((option) => {
    if (option.isDisabled) {
      return {
        option,
        isAvailable: false,
        reason: "disabled" as const,
        explanation: "Turned off in column settings",
      };
    }

    if (scope && !isConditionGroupEmpty(option.availability)) {
      const holds = evaluateConditionGroup(option.availability, scope);
      if (!holds) {
        return {
          option,
          isAvailable: false,
          reason: "condition" as const,
          explanation: `Requires ${describeConditionGroup(option.availability, columns, context)}`,
        };
      }
    }

    if (!ignoreTransitions && row) {
      const verdict = evaluateTransition(column, from, option.id);
      if (!verdict.isAllowed) {
        return {
          option,
          isAvailable: false,
          reason: "transition" as const,
          explanation: verdict.reason ?? "Not a permitted transition",
        };
      }
    }

    return { option, ...AVAILABLE };
  });
}

export function unavailableBehaviorOf(
  column: BoardColumnOf<"select">,
): UnavailableOptionBehavior {
  return column.config.unavailableBehavior ?? "disabled";
}

/** What the dropdown renders: hidden options are dropped, disabled ones kept. */
export function visibleOptions(
  entries: readonly OptionAvailability[],
  behavior: UnavailableOptionBehavior,
): readonly OptionAvailability[] {
  return behavior === "hidden" ? entries.filter((entry) => entry.isAvailable) : entries;
}

/** The verdict for one option id, for a commit-time check. */
export function availabilityOf(
  entries: readonly OptionAvailability[],
  optionId: string,
): OptionAvailability | undefined {
  return entries.find((entry) => entry.option.id === optionId);
}
