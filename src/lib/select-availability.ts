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

export type UnavailableReason = "disabled" | "condition" | "transition";

export interface OptionAvailability {
  readonly option: SelectOption;
  readonly isAvailable: boolean;
  readonly reason: UnavailableReason | null;
  readonly explanation: string;
}

export interface AvailabilityInput {
  readonly column: BoardColumnOf<"select">;
  readonly row: BoardRow | null;
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  readonly ignoreTransitions?: boolean;
}

const AVAILABLE = { isAvailable: true, reason: null, explanation: "" } as const;

function currentKey(row: BoardRow | null, column: BoardColumnOf<"select">): string {
  const value: CellValue | undefined = row?.cells[column.id];
  if (!value || value.kind !== "select") return EMPTY_OPTION_KEY;

  return transitionKeyOf(value.optionIds[0] ?? EMPTY_OPTION_KEY);
}

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

export function visibleOptions(
  entries: readonly OptionAvailability[],
  behavior: UnavailableOptionBehavior,
): readonly OptionAvailability[] {
  return behavior === "hidden" ? entries.filter((entry) => entry.isAvailable) : entries;
}

export function availabilityOf(
  entries: readonly OptionAvailability[],
  optionId: string,
): OptionAvailability | undefined {
  return entries.find((entry) => entry.option.id === optionId);
}
