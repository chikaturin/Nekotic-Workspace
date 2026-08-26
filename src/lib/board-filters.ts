import { COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import type { BoardColumn, ColumnType, FilterOperator, ViewFilter } from "@/types";

/**
 * Which conditions a column offers, and how its value is written.
 *
 * Operators are per cell type: "contains" is meaningless on a date and
 * "before" is meaningless on a select, so neither is offered there.
 */

export const OPERATOR_LABELS: Readonly<Record<FilterOperator, string>> = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  notContains: "does not contain",
  before: "is before",
  after: "is after",
  onOrBefore: "is on or before",
  onOrAfter: "is on or after",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const TEXT_OPERATORS: readonly FilterOperator[] = [
  "is",
  "isNot",
  "contains",
  "notContains",
  "isEmpty",
  "isNotEmpty",
];

const CHOICE_OPERATORS: readonly FilterOperator[] = ["is", "isNot", "isEmpty", "isNotEmpty"];

const DATE_OPERATORS: readonly FilterOperator[] = [
  "is",
  "before",
  "after",
  "onOrBefore",
  "onOrAfter",
  "isEmpty",
  "isNotEmpty",
];

const PRESENCE_OPERATORS: readonly FilterOperator[] = ["isEmpty", "isNotEmpty"];

const OPERATORS_BY_TYPE: Readonly<Record<ColumnType, readonly FilterOperator[]>> = {
  text: TEXT_OPERATORS,
  longText: TEXT_OPERATORS,
  select: CHOICE_OPERATORS,
  user: CHOICE_OPERATORS,
  date: DATE_OPERATORS,
  attachment: PRESENCE_OPERATORS,
  relation: ["contains", ...PRESENCE_OPERATORS],
};

export function operatorsFor(type: ColumnType): readonly FilterOperator[] {
  return OPERATORS_BY_TYPE[type];
}

/** How the value input should be rendered for this column. */
export type FilterValueKind = "none" | "text" | "option" | "user" | "date";

export function valueKindFor(column: BoardColumn, operator: FilterOperator): FilterValueKind {
  if (operator === "isEmpty" || operator === "isNotEmpty") return "none";

  switch (column.type) {
    case "select":
      return "option";
    case "user":
      return "user";
    case "date":
      return "date";
    default:
      return "text";
  }
}

/** A condition that is valid the moment it is added. */
export function makeFilter(column: BoardColumn, id: string): ViewFilter {
  const operator = operatorsFor(column.type)[0] ?? "isNotEmpty";
  return { id, columnId: column.id, operator, value: "" };
}

/** Keep an operator that the new column supports, otherwise take its first. */
export function reconcileOperator(column: BoardColumn, operator: FilterOperator): FilterOperator {
  const allowed = operatorsFor(column.type);
  return allowed.includes(operator) ? operator : (allowed[0] ?? "isNotEmpty");
}

export function describeFilter(filter: ViewFilter, columns: readonly BoardColumn[]): string {
  const column = columns.find((candidate) => candidate.id === filter.columnId);
  const name = column?.name ?? COLUMN_TYPE_LABELS.text;
  const operator = OPERATOR_LABELS[filter.operator];

  return filter.value ? `${name} ${operator} ${filter.value}` : `${name} ${operator}`;
}
