import { UNGROUPED_KEY } from "@/lib/board-grouping";
import type { BoardColumnOf, SelectOption, TransitionRules } from "@/types";

/**
 * Status transition rules.
 *
 * Which status may follow which is *configuration*, authored by the user and
 * stored on the select column. Nothing in this file — or anywhere else — knows
 * that "Debug" may not reach "Done": it only knows how to read the table the
 * user wrote, keyed by immutable option id, so renaming a status never breaks
 * the workflow.
 *
 * Two ideas carry the whole model:
 *
 *   - **Off by default.** With `enabled: false` every move is permitted, which
 *     is how a board behaves until someone opts in. Nobody has to configure a
 *     workflow to use a Kanban.
 *   - **A status the table does not mention is not governed.** Adding a status
 *     therefore never freezes it, and never freezes the board around it — it
 *     is simply unrestricted until the user says otherwise.
 *
 * This is not permission. Permission answers "may this person edit Status at
 * all"; a transition rule answers "may Status go from here to there". Both are
 * checked, separately, before a drop is written.
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
 * Whether the table has anything to say about this status.
 *
 * A key the user has never touched is *ungoverned*: moves in and out of it are
 * allowed even while rules are on. That is what makes adding a status safe —
 * an allow-list that silently strands every new status would be a trap, and
 * "configure it or the board stops working" is not a reasonable default.
 */
export function isGoverned(rules: TransitionRules, key: string): boolean {
  return Object.hasOwn(rules.transitions, key);
}

/** Statuses the table says nothing about — what the editor offers to set up. */
export function ungovernedKeys(
  rules: TransitionRules,
  options: readonly SelectOption[],
): readonly string[] {
  return transitionKeys(options).filter((key) => !isGoverned(rules, key));
}

/** Governed statuses that permit no move at all — cards there cannot leave. */
export function strandedKeys(
  rules: TransitionRules,
  options: readonly SelectOption[],
): readonly string[] {
  return transitionKeys(options).filter(
    (key) => isGoverned(rules, key) && (rules.transitions[key]?.length ?? 0) === 0,
  );
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
 * Rules that are off, a move that changes nothing, and any move touching a
 * status the table does not govern all pass. Under an allow-list, a target
 * missing from the source's list is refused, and the refusal names both ends
 * and where the record *can* go — a rejection worth reading tells you the way
 * out, not just that you took a wrong turn.
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

  // Either end being unconfigured means the user has not decided yet.
  if (!isGoverned(rules, from) || !isGoverned(rules, to)) return ALLOWED;

  const allowed = rules.transitions[from] ?? [];
  if (allowed.includes(to)) return ALLOWED;

  const { options } = column.config;
  const names = allowed.map((key) => transitionLabel(key, options));
  const whereInstead =
    names.length > 0
      ? ` ${transitionLabel(from, options)} can move to ${names.join(", ")}.`
      : ` ${transitionLabel(from, options)} has no permitted moves.`;

  return {
    isAllowed: false,
    reason:
      `${column.name} cannot go straight from ${transitionLabel(from, options)}` +
      ` to ${transitionLabel(to, options)}.${whereInstead}`,
  };
}

/**
 * The statuses a record currently sitting on `fromKey` may move to.
 *
 * Kanban asks this once when a drag starts, so hovering a column is a set
 * lookup rather than a rule evaluation — and never a request.
 */
export function allowedTargets(
  column: BoardColumnOf<"select">,
  fromKey: string,
): readonly string[] {
  const rules = transitionRulesOf(column);
  const keys = transitionKeys(column.config.options);
  if (!rules.enabled) return keys;

  const from = transitionKeyOf(fromKey);
  if (!isGoverned(rules, from)) return keys;

  // An ungoverned target stays reachable even from a governed source.
  const ungoverned = keys.filter((key) => !isGoverned(rules, key));
  return [from, ...(rules.transitions[from] ?? []), ...ungoverned];
}

/* ----------------------------------------------------------------- presets */

/** Every status may reach every other. Governs all of them explicitly. */
export function allowAllTransitions(options: readonly SelectOption[]): TransitionRules {
  const keys = transitionKeys(options);

  return {
    enabled: true,
    mode: "allow-list",
    transitions: Object.fromEntries(
      keys.map((key) => [key, keys.filter((candidate) => candidate !== key)]),
    ),
  };
}

/** Every status governed, none connected — a deliberately frozen board. */
export function clearAllTransitions(options: readonly SelectOption[]): TransitionRules {
  return {
    enabled: true,
    mode: "allow-list",
    transitions: Object.fromEntries(transitionKeys(options).map((key) => [key, []])),
  };
}

/**
 * The column's own order, read as a pipeline: each status may reach the next,
 * and with `allowBackward` the previous one too. The empty bucket feeds the
 * first status, because a record with no status has to start somewhere.
 */
export function linearTransitions(
  options: readonly SelectOption[],
  { allowBackward = false }: { readonly allowBackward?: boolean } = {},
): TransitionRules {
  const ids = options.map((option) => option.id);

  const transitions: Record<string, readonly string[]> = {
    [EMPTY_OPTION_KEY]: ids.length > 0 && ids[0] ? [ids[0]] : [],
  };

  ids.forEach((id, index) => {
    const next = ids[index + 1];
    const previous = ids[index - 1];

    transitions[id] = [
      ...(next ? [next] : []),
      ...(allowBackward && previous ? [previous] : []),
    ];
  });

  return { enabled: true, mode: "allow-list", transitions };
}

/**
 * What flipping the toggle on starts from.
 *
 * A linear workflow that also allows stepping back: the most common intent,
 * immediately meaningful, and forgiving enough that turning rules on cannot
 * strand a card someone dragged by mistake. One click changes it to anything
 * else.
 */
export function seedTransitionRules(options: readonly SelectOption[]): TransitionRules {
  return linearTransitions(options, { allowBackward: true });
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

/** Replace one status's whole target list — the row-level All / None buttons. */
export function setTransitions(
  rules: TransitionRules,
  fromKey: string,
  targets: readonly string[],
): TransitionRules {
  return { ...rules, transitions: { ...rules.transitions, [fromKey]: [...targets] } };
}

/** Stop governing a status, returning it to "no restriction". */
export function clearTransitionsFor(rules: TransitionRules, fromKey: string): TransitionRules {
  const transitions = Object.fromEntries(
    Object.entries(rules.transitions).filter(([key]) => key !== fromKey),
  );

  return { ...rules, transitions };
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
