"use client";

import { ArrowRight, CircleAlert, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import {
  allowAllTransitions,
  clearAllTransitions,
  clearTransitionsFor,
  EMPTY_OPTION_KEY,
  isGoverned,
  linearTransitions,
  NO_TRANSITION_RULES,
  seedTransitionRules,
  setTransitions,
  strandedKeys,
  toggleTransition,
  transitionKeys,
  transitionLabel,
  ungovernedKeys,
} from "@/lib/transition-rules";
import { cn } from "@/lib/utils";
import type { SelectOption, TransitionRules } from "@/types";

interface TransitionRulesEditorProps {
  readonly options: readonly SelectOption[];
  readonly rules: TransitionRules;
  readonly onChange: (rules: TransitionRules) => void;
  readonly columnName: string;
  readonly canEdit: boolean;
}

export function TransitionRulesEditor({
  options,
  rules,
  onChange,
  columnName,
  canEdit,
}: TransitionRulesEditorProps) {
  const keys = transitionKeys(options);
  const unconfigured = ungovernedKeys(rules, options);
  const stranded = strandedKeys(rules, options);
  const noun = columnName.toLowerCase();

  if (!canEdit) {
    return <TransitionRulesSummary options={options} rules={rules} noun={noun} />;
  }

  return (
    <div className="space-y-2.5">
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox
          checked={rules.enabled}
          aria-label="Restrict status transitions"
          className="mt-0.5"
          onChange={(event) =>
            onChange(
              event.target.checked
                ?
                  Object.keys(rules.transitions).length > 0
                  ? { ...rules, enabled: true }
                  : seedTransitionRules(options)
                : { ...rules, enabled: false },
            )
          }
        />
        <span className="min-w-0">
          <span className="block text-ui font-medium text-foreground">
            Restrict {noun} transitions
          </span>
          <span className="block text-body text-faint-foreground">
            {rules.enabled
              ? "Only the moves ticked below are allowed. A drag that breaks a rule is refused and the card stays where it was."
              : `Off — a card can be dragged from any ${noun} to any other, like a plain Kanban.`}
          </span>
        </span>
      </label>

      {rules.enabled && (
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-hairline bg-hover/40 px-1.5 py-1">
            <span className="px-1 text-body text-faint-foreground">Start from</span>
            <Preset label="Anything" onClick={() => onChange(allowAllTransitions(options))} />
            <Preset
              label="Linear →"
              title={`Each ${noun} may only move to the next one in the list`}
              onClick={() => onChange(linearTransitions(options))}
            />
            <Preset
              label="Linear ⇄"
              title={`Each ${noun} may move to the next or back to the previous one`}
              onClick={() => onChange(linearTransitions(options, { allowBackward: true }))}
            />
            <Preset label="Nothing" onClick={() => onChange(clearAllTransitions(options))} />
          </div>

          <ul className="space-y-1.5">
            {keys.map((from) => {
              const targets = rules.transitions[from] ?? [];
              const governed = isGoverned(rules, from);
              const isStranded = governed && targets.length === 0;

              return (
                <li
                  key={from}
                  className={cn(
                    "rounded-md border bg-surface p-2",
                    isStranded ? "border-warning/40" : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-body text-faint-foreground">From</span>
                      <OptionPill optionKey={from} options={options} />
                      <ArrowRight className="size-3 text-faint-foreground" />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                      {keys
                        .filter((to) => to !== from)
                        .map((to) => (
                          <TargetToggle
                            key={to}
                            optionKey={to}
                            options={options}
                            isOn={targets.includes(to)}
                            fromLabel={transitionLabel(from, options)}
                            onToggle={() => onChange(toggleTransition(rules, from, to))}
                          />
                        ))}
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-body"
                        title={`Allow ${transitionLabel(from, options)} to move anywhere`}
                        onClick={() =>
                          onChange(
                            setTransitions(
                              rules,
                              from,
                              keys.filter((to) => to !== from),
                            ),
                          )
                        }
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-body"
                        title={
                          governed
                            ? `Lift the rule — ${transitionLabel(from, options)} goes back to unrestricted`
                            : `Pin ${transitionLabel(from, options)} in place — no move out of it`
                        }
                        onClick={() =>
                          onChange(
                            governed
                              ? clearTransitionsFor(rules, from)
                              : setTransitions(rules, from, []),
                          )
                        }
                      >
                        {governed ? "Reset" : "None"}
                      </Button>
                    </div>
                  </div>

                  {!governed && (
                    <p className="mt-1 flex items-center gap-1 text-micro text-faint-foreground">
                      <Info className="size-2.5 shrink-0" />
                      No rule yet — cards can move in and out freely. Tick a target to restrict it.
                    </p>
                  )}

                  {isStranded && (
                    <p className="mt-1 flex items-center gap-1 text-micro text-warning">
                      <CircleAlert className="size-2.5 shrink-0" />
                      Cards here cannot move anywhere. Tick a target, or Reset to lift the rule.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {unconfigured.length > 0 && (
            <p className="text-body text-muted-foreground">
              {unconfigured.map((key) => transitionLabel(key, options)).join(", ")}{" "}
              {unconfigured.length === 1 ? "has" : "have"} no transition rule yet, so{" "}
              {unconfigured.length === 1 ? "it stays" : "they stay"} unrestricted until you tick
              something.
            </p>
          )}

          {stranded.length === keys.length && keys.length > 0 && (
            <p className="flex items-center gap-1 text-body text-warning">
              <CircleAlert className="size-3 shrink-0" />
              Nothing is allowed anywhere — no card on this board can change {noun}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TransitionRulesSummary({
  options,
  rules,
  noun,
}: {
  readonly options: readonly SelectOption[];
  readonly rules: TransitionRules;
  readonly noun: string;
}) {
  const governed = transitionKeys(options).filter((key) => isGoverned(rules, key));

  return (
    <div className="space-y-2">
      <p className="flex items-start gap-1.5 text-body text-faint-foreground">
        <Lock aria-hidden="true" className="mt-px size-3 shrink-0" />
        <span>
          {rules.enabled
            ? `Only the moves below are allowed. Managers and above can change them.`
            : `Off — a card can be dragged from any ${noun} to any other. Managers and above can restrict it.`}
        </span>
      </p>

      {rules.enabled && governed.length > 0 && (
        <ul className="space-y-1">
          {governed.map((from) => {
            const targets = rules.transitions[from] ?? [];

            return (
              <li
                key={from}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-surface px-2 py-1.5"
              >
                <OptionPill optionKey={from} options={options} />
                <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-faint-foreground" />

                {targets.length > 0 ? (
                  targets.map((to) => <OptionPill key={to} optionKey={to} options={options} />)
                ) : (
                  <span className="flex items-center gap-1 text-body text-warning">
                    <CircleAlert aria-hidden="true" className="size-3 shrink-0" />
                    nowhere — cards here cannot move
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rules.enabled && governed.length === 0 && (
        <p className="text-body text-faint-foreground">
          Restrictions are on, but no {noun} has a rule yet — everything still moves freely.
        </p>
      )}
    </div>
  );
}

function Preset({
  label,
  title,
  onClick,
}: {
  readonly label: string;
  readonly title?: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 px-1.5 text-body"
      title={title}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function TargetToggle({
  optionKey,
  options,
  isOn,
  fromLabel,
  onToggle,
}: {
  readonly optionKey: string;
  readonly options: readonly SelectOption[];
  readonly isOn: boolean;
  readonly fromLabel: string;
  readonly onToggle: () => void;
}) {
  const label = transitionLabel(optionKey, options);

  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={`Allow ${fromLabel} to ${label}`}
      onClick={onToggle}
      className={cn(
        "rounded-full outline-offset-2 transition-opacity focus-visible:outline-2 focus-visible:outline-ring",
        isOn ? "opacity-100" : "opacity-45 grayscale hover:opacity-75",
      )}
    >
      <OptionPill optionKey={optionKey} options={options} />
    </button>
  );
}

function OptionPill({
  optionKey,
  options,
}: {
  readonly optionKey: string;
  readonly options: readonly SelectOption[];
}) {
  if (optionKey === EMPTY_OPTION_KEY) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full border border-dashed border-border px-1.5 py-px text-body text-faint-foreground">
        No value
      </span>
    );
  }

  const option = options.find((candidate) => candidate.id === optionKey);
  if (!option) return <span className="text-body">{optionKey}</span>;

  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full border px-1.5 py-px text-body",
        SELECT_COLOR_CLASSES[option.color],
      )}
    >
      {option.label}
    </span>
  );
}

export { NO_TRANSITION_RULES };
