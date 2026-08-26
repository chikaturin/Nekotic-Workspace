import { UNGROUPED_KEY } from "@/lib/board-grouping";
import type { BoardColumnOf, SelectOption, TransitionRules } from "@/types";

/**
 * Status transition rules.
 *
 * Which status may follow which is *configuration*, authored by the user and
 * stored on the select column. Nothing in this file — or anywhere else — knows
 * that "Debug" may not reach "Done": it only knows how to read the table the
 * user wrote.
 *
 * This is not permission. Permission answers "may this person edit Status at
 * all"; a transition rule answers "may Status go from here to there". Both are
 * checked, separately, before a Kanban drop is written.
 */

/** Stands for the empty bucket on either side of a transition. */
export const EMPTY_OPTION_KEY = "__empty__";

/** Kanban's ungrouped column and the rules' empty key are the same bucket. */
export function transitionKeyOf(groupKey: string): string {
  return groupKey === UNGROUPED_KEY ? EMPTY_OPTION_KEY : groupKey;
}

export const NO_TRANSITION_RULES: TransitionRules = {
  enabled: false,
  mode: "allow-list",
  transitions: {},
};

export function transitionRulesOf(column: BoardColumnOf<"select">): TransitionRules {
  return column.config.transitionRules ?? NO_TRANSITION_RULES;
}

/** Every key a rule table can be written against, empty bucket included. */
export function transitionKeys(options: readonly SelectOption[]): readonly string[] {
  return [...options.map((option) => option.id), EMPTY_OPTION_KEY];
}

export function transitionLabel(key: string, options: readonly SelectOption[]): string {
  if (key === EMPTY_OPTION_KEY) return "No value";
  return options.find((option) => option.id === key)?.label ?? key;
}

/**
 * A blank allow-list: every status declared, none of them connected yet.
 * Turning rules on with nothing declared would freeze the board, so the first
 * table a user is shown starts from "everything currently reachable".
 */
export function seedTransitionRules(options: readonly SelectOption[]): TransitionRules {
  const keys = transitionKeys(options);

  return {
    enabled: true,
    mode: "allow-list",
    transitions: Object.fromEntries(
      keys.map((key) => [key, keys.filter((candidate) => candidate !== key)]),
    ),
  };
}

export interface TransitionVerdict {
  readonly isAllowed: boolean;
  /** Present only when refused — the sentence the toast shows. */
  readonly reason?: string;
}

const ALLOWED: TransitionVerdict = { isAllowed: true };

/**
 * May `fromKey` become `toKey` on this column?
 *
 * Rules that are off, or a move that changes nothing, always pass. Under an
 * allow-list, a target missing from the source's list is refused and the
 * refusal names both ends so the message is worth reading.
 */
export function evaluateTransition(
  column: BoardColumnOf<"select">,
  fromKey: string,
  toKey: string,
): TransitionVerdict {
  const rules = transitionRulesOf(column);
  if (!rules.enabled) return ALLOWED;

  const from = transitionKeyOf(fromKey);
  const to = transitionKeyOf(toKey);
  if (from === to) return ALLOWED;

  const allowed = rules.transitions[from] ?? [];
  if (allowed.includes(to)) return ALLOWED;

  const { options } = column.config;

  return {
    isAllowed: false,
    reason: `${column.name} cannot go straight from ${transitionLabel(from, options)} to ${transitionLabel(to, options)}.`,
  };
}

/** The statuses a record currently sitting on `fromKey` may move to. */
export function allowedTargets(
  column: BoardColumnOf<"select">,
  fromKey: string,
): readonly string[] {
  const rules = transitionRulesOf(column);
  const keys = transitionKeys(column.config.options);
  if (!rules.enabled) return keys;

  const from = transitionKeyOf(fromKey);
  return [from, ...(rules.transitions[from] ?? [])];
}

/* ---------------------------------------------------------------- editing */

/** Add or remove one edge. Immutable: a new rule table comes back. */
export function toggleTransition(
  rules: TransitionRules,
  fromKey: string,
  toKey: string,
): TransitionRules {
  const current = rules.transitions[fromKey] ?? [];
  const next = current.includes(toKey)
    ? current.filter((key) => key !== toKey)
    : [...current, toKey];

  return { ...rules, transitions: { ...rules.transitions, [fromKey]: next } };
}

/** Drop edges pointing at options the column no longer has. */
export function pruneTransitionRules(
  rules: TransitionRules,
  options: readonly SelectOption[],
): TransitionRules {
  const keys = new Set(transitionKeys(options));

  const transitions = Object.fromEntries(
    Object.entries(rules.transitions)
      .filter(([from]) => keys.has(from))
      .map(([from, targets]) => [from, targets.filter((target) => keys.has(target))]),
  );

  return { ...rules, transitions };
}
