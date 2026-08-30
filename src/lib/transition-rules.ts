import { UNGROUPED_KEY } from "@/lib/board-grouping";
import type { BoardColumnOf, SelectOption, TransitionRules } from "@/types";

export const EMPTY_OPTION_KEY = "__empty__";

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

export function transitionKeys(options: readonly SelectOption[]): readonly string[] {
  return [...options.map((option) => option.id), EMPTY_OPTION_KEY];
}

export function transitionLabel(key: string, options: readonly SelectOption[]): string {
  if (key === EMPTY_OPTION_KEY) return "No value";
  return options.find((option) => option.id === key)?.label ?? key;
}

export function isGoverned(rules: TransitionRules, key: string): boolean {
  return Object.hasOwn(rules.transitions, key);
}

export function ungovernedKeys(
  rules: TransitionRules,
  options: readonly SelectOption[],
): readonly string[] {
  return transitionKeys(options).filter((key) => !isGoverned(rules, key));
}

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
  readonly reason?: string;
}

const ALLOWED: TransitionVerdict = { isAllowed: true };

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

export function allowedTargets(
  column: BoardColumnOf<"select">,
  fromKey: string,
): readonly string[] {
  const rules = transitionRulesOf(column);
  const keys = transitionKeys(column.config.options);
  if (!rules.enabled) return keys;

  const from = transitionKeyOf(fromKey);
  if (!isGoverned(rules, from)) return keys;

  const ungoverned = keys.filter((key) => !isGoverned(rules, key));
  return [from, ...(rules.transitions[from] ?? []), ...ungoverned];
}

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

export function clearAllTransitions(options: readonly SelectOption[]): TransitionRules {
  return {
    enabled: true,
    mode: "allow-list",
    transitions: Object.fromEntries(transitionKeys(options).map((key) => [key, []])),
  };
}

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

export function seedTransitionRules(options: readonly SelectOption[]): TransitionRules {
  return linearTransitions(options, { allowBackward: true });
}

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

export function setTransitions(
  rules: TransitionRules,
  fromKey: string,
  targets: readonly string[],
): TransitionRules {
  return { ...rules, transitions: { ...rules.transitions, [fromKey]: [...targets] } };
}

export function clearTransitionsFor(rules: TransitionRules, fromKey: string): TransitionRules {
  const transitions = Object.fromEntries(
    Object.entries(rules.transitions).filter(([key]) => key !== fromKey),
  );

  return { ...rules, transitions };
}

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
