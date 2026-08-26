"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import {
  EMPTY_OPTION_KEY,
  seedTransitionRules,
  toggleTransition,
  transitionKeys,
  transitionLabel,
  NO_TRANSITION_RULES,
} from "@/lib/transition-rules";
import { cn } from "@/lib/utils";
import type { SelectOption, TransitionRules } from "@/types";

interface TransitionRulesEditorProps {
  readonly options: readonly SelectOption[];
  readonly rules: TransitionRules;
  readonly onChange: (rules: TransitionRules) => void;
  readonly columnName: string;
}

/**
 * The transition table, as a grid of checkboxes.
 *
 * A row is a status a record can be in; the ticked columns are the statuses it
 * may move to. This is the whole rule — there is no code path anywhere that
 * knows a particular status pair, only this table.
 *
 * Turning rules on seeds "everything reachable" rather than an empty table: an
 * allow-list that starts empty would freeze every card on the board, which is
 * a trap rather than a default.
 */
export function TransitionRulesEditor({
  options,
  rules,
  onChange,
  columnName,
}: TransitionRulesEditorProps) {
  const keys = transitionKeys(options);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-foreground">
          <Checkbox
            checked={rules.enabled}
            aria-label="Only allow declared transitions"
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? rules.enabled
                    ? rules
                    : seedTransitionRules(options)
                  : { ...rules, enabled: false },
              )
            }
          />
          Only allow declared transitions
        </label>

        {rules.enabled && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => onChange(seedTransitionRules(options))}
            >
              Allow all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => onChange({ ...rules, transitions: {} })}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {!rules.enabled ? (
        <p className="text-[11px] text-faint-foreground">
          Every {columnName.toLowerCase()} change is permitted. Turn this on to declare which
          transitions are allowed — a drag that breaks a rule is refused and the card stays put.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-[11px]">
            <caption className="sr-only">
              Allowed {columnName} transitions: each row is a starting status, each ticked column a
              status it may move to.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-b border-r border-hairline bg-hover px-2 py-1.5 text-left font-medium text-muted-foreground"
                >
                  From
                  <ArrowRight className="ml-1 inline size-3" />
                </th>
                {keys.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="border-b border-r border-hairline bg-hover px-1.5 py-1.5 font-medium text-muted-foreground"
                  >
                    <OptionLabel optionKey={key} options={options} />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {keys.map((from) => {
                const targets = rules.transitions[from] ?? [];

                return (
                  <tr key={from}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-hairline bg-surface px-2 py-1 text-left font-normal"
                    >
                      <OptionLabel optionKey={from} options={options} />
                    </th>

                    {keys.map((to) => {
                      const isSelf = from === to;

                      return (
                        <td
                          key={to}
                          className={cn(
                            "border-b border-r border-hairline px-1.5 py-1 text-center",
                            isSelf && "bg-hover/60",
                          )}
                        >
                          {isSelf ? (
                            <span className="text-faint-foreground" title="Staying put is always allowed">
                              —
                            </span>
                          ) : (
                            <Checkbox
                              checked={targets.includes(to)}
                              aria-label={`Allow ${transitionLabel(from, options)} to ${transitionLabel(to, options)}`}
                              onChange={() => onChange(toggleTransition(rules, from, to))}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OptionLabel({
  optionKey,
  options,
}: {
  readonly optionKey: string;
  readonly options: readonly SelectOption[];
}) {
  if (optionKey === EMPTY_OPTION_KEY) {
    return <span className="text-faint-foreground">No value</span>;
  }

  const option = options.find((candidate) => candidate.id === optionKey);
  if (!option) return <span>{optionKey}</span>;

  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full border px-1.5 py-px",
        SELECT_COLOR_CLASSES[option.color],
      )}
    >
      {option.label}
    </span>
  );
}

export { NO_TRANSITION_RULES };
