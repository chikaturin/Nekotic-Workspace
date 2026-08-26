import { cellOf, cellText, isCellEmpty, type CellContext } from "@/lib/cell-values";
import type {
  BoardColumn,
  BoardRow,
  CellValue,
  ColumnType,
  Condition,
  ConditionGroup,
  ConditionOperator,
} from "@/types";

/**
 * One condition evaluator for the whole app.
 *
 * It answers a single question — "does this record satisfy this rule?" — over
 * the board's own cell values, and knows nothing about *why* it is being asked.
 * Conditional select options use it today; view filters and any later
 * rule-based feature can use the same shape.
 *
 * It is deliberately not a workflow engine: there are no actions, no triggers
 * and no side effects. A group in, a boolean out.
 */

export const OPERATOR_LABELS: Readonly<Record<ConditionOperator, string>> = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  notContains: "does not contain",
  isAnyOf: "is any of",
  isNoneOf: "is none of",
  before: "is before",
  after: "is after",
  on: "is on",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const PRESENCE: readonly ConditionOperator[] = ["isEmpty", "isNotEmpty"];

const TEXT_OPERATORS: readonly ConditionOperator[] = [
  "is",
  "isNot",
  "contains",
  "notContains",
  ...PRESENCE,
];

const CHOICE_OPERATORS: readonly ConditionOperator[] = [
  "is",
  "isNot",
  "isAnyOf",
  "isNoneOf",
  ...PRESENCE,
];

const IDENTITY_OPERATORS: readonly ConditionOperator[] = ["is", "isNot", ...PRESENCE];

const DATE_OPERATORS: readonly ConditionOperator[] = ["before", "after", "on", ...PRESENCE];

/**
 * The operators each column type offers. There is no number column in this
 * schema, so the numeric comparisons the spec lists have no column to apply
 * to — they are left out rather than faked against text.
 */
const OPERATORS_BY_TYPE: Readonly<Record<ColumnType, readonly ConditionOperator[]>> = {
  text: TEXT_OPERATORS,
  longText: TEXT_OPERATORS,
  select: CHOICE_OPERATORS,
  user: IDENTITY_OPERATORS,
  date: DATE_OPERATORS,
  attachment: PRESENCE,
  relation: ["contains", ...PRESENCE],
};

export function conditionOperatorsFor(type: ColumnType): readonly ConditionOperator[] {
  return OPERATORS_BY_TYPE[type];
}

/** Whether the operator needs a value at all, one value, or a list. */
export type ConditionValueArity = "none" | "single" | "list";

export function valueArityFor(operator: ConditionOperator): ConditionValueArity {
  if (operator === "isEmpty" || operator === "isNotEmpty") return "none";
  if (operator === "isAnyOf" || operator === "isNoneOf") return "list";
  return "single";
}

/** Keep an operator the new column supports, otherwise fall back to its first. */
export function reconcileConditionOperator(
  type: ColumnType,
  operator: ConditionOperator,
): ConditionOperator {
  const allowed = conditionOperatorsFor(type);
  return allowed.includes(operator) ? operator : (allowed[0] ?? "isNotEmpty");
}

/** A condition that is already valid the moment it is added to a group. */
export function makeCondition(column: BoardColumn, id: string): Condition {
  return {
    id,
    columnId: column.id,
    operator: conditionOperatorsFor(column.type)[0] ?? "isNotEmpty",
    value: "",
  };
}

export function makeConditionGroup(id: string): ConditionGroup {
  return { id, conjunction: "and", conditions: [], groups: [] };
}

/** True when the group holds nothing to test — an empty rule never gates. */
export function isConditionGroupEmpty(group: ConditionGroup | null | undefined): boolean {
  if (!group) return true;
  return (
    group.conditions.length === 0 && group.groups.every((nested) => isConditionGroupEmpty(nested))
  );
}

/* ------------------------------------------------------------------ values */

/** Ids stored by an identity cell, whatever its kind. */
function idsOf(value: CellValue): readonly string[] {
  if (value.kind === "select") return value.optionIds;
  if (value.kind === "user") return value.userIds;
  if (value.kind === "relation") return value.rowIds;
  return [];
}

function dayNumber(iso: string): number {
  const parsed = Date.parse(iso.slice(0, 10));
  return Number.isNaN(parsed) ? Number.NaN : Math.floor(parsed / 86_400_000);
}

/** Values a set operator tests against — `values` when given, else `value`. */
function needlesOf(condition: Condition): readonly string[] {
  if (condition.values && condition.values.length > 0) return condition.values;
  return condition.value.trim().length > 0 ? [condition.value] : [];
}

/**
 * Identity cells match on the stored id first and the rendered label second,
 * so a rule written by the builder (an id) and one written by hand (a name)
 * agree — the same tolerance `matchesFilter` already applies to view filters.
 */
function matchesIdentity(
  value: CellValue,
  column: BoardColumn,
  context: CellContext,
  needle: string,
): boolean {
  const wanted = needle.trim().toLowerCase();
  if (wanted.length === 0) return false;

  const ids = idsOf(value).map((id) => id.toLowerCase());
  if (ids.includes(wanted)) return true;

  return cellText(value, column, context).toLowerCase() === wanted;
}

function matchesDate(iso: string | null, condition: Condition): boolean {
  if (!iso) return false;

  const bound = dayNumber(condition.value);
  if (Number.isNaN(bound)) return true;

  const day = dayNumber(iso);
  if (Number.isNaN(day)) return false;

  switch (condition.operator) {
    case "before":
      return day < bound;
    case "after":
      return day > bound;
    case "on":
      return day === bound;
    default:
      return true;
  }
}

/* --------------------------------------------------------------- evaluate */

export interface ConditionScope {
  readonly row: BoardRow;
  readonly columns: ReadonlyMap<string, BoardColumn>;
  readonly context: CellContext;
}

/**
 * One condition against one record.
 *
 * A condition that points at a column the board no longer has is *ignored*
 * (returns true) rather than failing closed: a deleted column must not silently
 * lock every option that mentioned it.
 */
export function evaluateCondition(condition: Condition, scope: ConditionScope): boolean {
  const column = scope.columns.get(condition.columnId);
  if (!column) return true;

  const value = cellOf(scope.row, column);

  if (condition.operator === "isEmpty") return isCellEmpty(value);
  if (condition.operator === "isNotEmpty") return !isCellEmpty(value);

  if (value.kind === "date") return matchesDate(value.iso, condition);

  const isIdentity =
    value.kind === "select" || value.kind === "user" || value.kind === "relation";

  if (isIdentity) {
    const needles = needlesOf(condition);

    switch (condition.operator) {
      case "is":
      case "isAnyOf":
        return needles.some((needle) => matchesIdentity(value, column, scope.context, needle));
      case "isNot":
      case "isNoneOf":
        return !needles.some((needle) => matchesIdentity(value, column, scope.context, needle));
      case "contains":
      case "notContains": {
        const label = cellText(value, column, scope.context).toLowerCase();
        const hit = needles.some((needle) => label.includes(needle.trim().toLowerCase()));
        return condition.operator === "contains" ? hit : !hit;
      }
      default:
        return true;
    }
  }

  const text = cellText(value, column, scope.context).toLowerCase();
  const needle = condition.value.trim().toLowerCase();

  switch (condition.operator) {
    case "is":
      return text === needle;
    case "isNot":
      return text !== needle;
    case "contains":
      return text.includes(needle);
    case "notContains":
      return !text.includes(needle);
    case "isAnyOf":
      return needlesOf(condition).some((item) => text === item.trim().toLowerCase());
    case "isNoneOf":
      return !needlesOf(condition).some((item) => text === item.trim().toLowerCase());
    default:
      return true;
  }
}

/**
 * A whole group, nested groups included.
 *
 * An empty group is satisfied — "no conditions" means "no gate", which is what
 * makes an option with no rules behave exactly as it did before rules existed.
 */
export function evaluateConditionGroup(
  group: ConditionGroup | null | undefined,
  scope: ConditionScope,
): boolean {
  if (isConditionGroupEmpty(group) || !group) return true;

  const results = [
    ...group.conditions.map((condition) => evaluateCondition(condition, scope)),
    ...group.groups
      .filter((nested) => !isConditionGroupEmpty(nested))
      .map((nested) => evaluateConditionGroup(nested, scope)),
  ];

  if (results.length === 0) return true;
  return group.conjunction === "or" ? results.some(Boolean) : results.every(Boolean);
}

/* -------------------------------------------------------------- describe */

/** Human sentence for one condition — what the lock tooltip shows. */
export function describeCondition(
  condition: Condition,
  columns: readonly BoardColumn[],
  context: CellContext = {},
): string {
  const column = columns.find((candidate) => candidate.id === condition.columnId);
  const name = column?.name ?? "Field";
  const operator = OPERATOR_LABELS[condition.operator];

  if (valueArityFor(condition.operator) === "none") return `${name} ${operator}`;

  const labels = needlesOf(condition).map((needle) => labelFor(needle, column, context));
  return labels.length > 0 ? `${name} ${operator} ${labels.join(", ")}` : `${name} ${operator}`;
}

function labelFor(
  needle: string,
  column: BoardColumn | undefined,
  context: CellContext,
): string {
  if (column?.type === "select") {
    return column.config.options.find((option) => option.id === needle)?.label ?? needle;
  }
  if (column?.type === "user") return context.people?.get(needle)?.name ?? needle;
  return needle;
}

/** The whole group as one line, e.g. `QA Status is Passed and Reviewer is not empty`. */
export function describeConditionGroup(
  group: ConditionGroup | null | undefined,
  columns: readonly BoardColumn[],
  context: CellContext = {},
): string {
  if (isConditionGroupEmpty(group) || !group) return "";

  const parts = [
    ...group.conditions.map((condition) => describeCondition(condition, columns, context)),
    ...group.groups
      .filter((nested) => !isConditionGroupEmpty(nested))
      .map((nested) => `(${describeConditionGroup(nested, columns, context)})`),
  ];

  return parts.join(group.conjunction === "or" ? " or " : " and ");
}

/* ---------------------------------------------------------------- editing */

/** Immutable group edits — every helper returns a new group. */
export function withCondition(group: ConditionGroup, condition: Condition): ConditionGroup {
  return { ...group, conditions: [...group.conditions, condition] };
}

export function withConditionPatched(
  group: ConditionGroup,
  conditionId: string,
  patch: Partial<Condition>,
): ConditionGroup {
  return {
    ...group,
    conditions: group.conditions.map((condition) =>
      condition.id === conditionId ? { ...condition, ...patch } : condition,
    ),
    groups: group.groups.map((nested) => withConditionPatched(nested, conditionId, patch)),
  };
}

export function withoutCondition(group: ConditionGroup, conditionId: string): ConditionGroup {
  return {
    ...group,
    conditions: group.conditions.filter((condition) => condition.id !== conditionId),
    groups: group.groups.map((nested) => withoutCondition(nested, conditionId)),
  };
}

export function withGroup(group: ConditionGroup, nested: ConditionGroup): ConditionGroup {
  return { ...group, groups: [...group.groups, nested] };
}

export function withGroupPatched(
  group: ConditionGroup,
  groupId: string,
  patch: Partial<ConditionGroup>,
): ConditionGroup {
  if (group.id === groupId) return { ...group, ...patch };
  return { ...group, groups: group.groups.map((nested) => withGroupPatched(nested, groupId, patch)) };
}

export function withoutGroup(group: ConditionGroup, groupId: string): ConditionGroup {
  return {
    ...group,
    groups: group.groups
      .filter((nested) => nested.id !== groupId)
      .map((nested) => withoutGroup(nested, groupId)),
  };
}
