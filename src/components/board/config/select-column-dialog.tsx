"use client";

import { ArrowDown, ArrowUp, CircleCheck, Lock, Plus, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConditionBuilder } from "@/components/board/config/condition-builder";
import { TransitionRulesEditor } from "@/components/board/config/transition-rules-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import { SELECT_COLORS } from "@/lib/board-schema";
import { describeConditionGroup, isConditionGroupEmpty, makeConditionGroup } from "@/lib/conditions";
import { NO_TRANSITION_RULES, pruneTransitionRules } from "@/lib/transition-rules";
import { cn } from "@/lib/utils";
import type {
  BoardColumn,
  BoardColumnOf,
  DirectoryUser,
  SelectColor,
  SelectOption,
  TransitionRules,
  UnavailableOptionBehavior,
} from "@/types";

const COLOUR_OPTIONS: readonly ListboxOption[] = SELECT_COLORS.map((color) => ({
  value: color,
  label: `${color.charAt(0).toUpperCase()}${color.slice(1)}`,
  color,
}));

interface SelectColumnDialogProps {
  readonly column: BoardColumnOf<"select"> | null;
  readonly columns: readonly BoardColumn[];
  readonly people: readonly DirectoryUser[];
  readonly canEdit: boolean;
  readonly onClose: () => void;
  readonly onSave: (config: SelectConfigDraft) => void;
}

export interface SelectConfigDraft {
  readonly options: readonly SelectOption[];
  readonly unavailableBehavior: UnavailableOptionBehavior;
  readonly completedOptionIds: readonly string[];
  readonly transitionRules: TransitionRules;
}

let seed = 0;

const nextOptionId = (columnId: string): string => `opt_${columnId}_${(seed += 1).toString(36)}`;

export function SelectColumnDialog({
  column,
  columns,
  people,
  canEdit,
  onClose,
  onSave,
}: SelectColumnDialogProps) {
  const [edited, setEdited] = useState<{ columnId: string; draft: SelectConfigDraft } | null>(null);

  const [expanded, setExpanded] = useState<{ columnId: string; optionId: string } | null>(null);

  const draft: SelectConfigDraft | null =
    column === null
      ? null
      : edited?.columnId === column.id
        ? edited.draft
        : {
            options: column.config.options,
            unavailableBehavior: column.config.unavailableBehavior ?? "disabled",
            completedOptionIds: column.config.completedOptionIds ?? [],
            transitionRules: column.config.transitionRules ?? NO_TRANSITION_RULES,
          };

  if (!column || !draft) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const expandedId = expanded?.columnId === column.id ? expanded.optionId : null;

  const close = () => {
    setEdited(null);
    setExpanded(null);
    onClose();
  };

  const patch = (changes: Partial<SelectConfigDraft>) =>
    setEdited({ columnId: column.id, draft: { ...draft, ...changes } });

  const patchOption = (optionId: string, changes: Partial<SelectOption>) =>
    patch({
      options: draft.options.map((option) =>
        option.id === optionId ? { ...option, ...changes } : option,
      ),
    });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= draft.options.length) return;

    const next = [...draft.options];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    patch({ options: next });
  };

  const addOption = () => {
    const option: SelectOption = {
      id: nextOptionId(column.id),
      label: `Option ${draft.options.length + 1}`,
      color: SELECT_COLORS[draft.options.length % SELECT_COLORS.length] ?? "gray",
    };
    patch({ options: [...draft.options, option] });
    setExpanded({ columnId: column.id, optionId: option.id });
  };

  const removeOption = (optionId: string) => {
    const options = draft.options.filter((option) => option.id !== optionId);

    patch({
      options,
      completedOptionIds: draft.completedOptionIds.filter((id) => id !== optionId),
      transitionRules: pruneTransitionRules(draft.transitionRules, options),
    });
  };

  const toggleCompleted = (optionId: string) => {
    const current = draft.completedOptionIds;
    patch({
      completedOptionIds: current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[85dvh] w-[52rem] max-w-[calc(100vw-2rem)] flex-col p-0">
        <header className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-title font-semibold text-foreground">
            <SlidersHorizontal className="size-4 text-faint-foreground" />
            {column.name} options &amp; rules
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-ui text-muted-foreground">
            Options, their order and colour, when each may be chosen, and which status changes the
            board permits.
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-ui font-medium text-foreground">Options</h3>
              <Badge variant="default">{draft.options.length}</Badge>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 gap-1 px-1.5 text-body"
                  onClick={addOption}
                >
                  <Plus />
                  Add option
                </Button>
              ) : (
                <Badge variant="default" className="ml-auto gap-1">
                  <Lock aria-hidden="true" className="size-2.5" />
                  read only
                </Badge>
              )}
            </div>

            <ul className="space-y-1.5">
              {draft.options.map((option, index) => {
                const isCompleted = draft.completedOptionIds.includes(option.id);
                const isExpanded = expandedId === option.id;
                const rule = describeConditionGroup(option.availability, columns);

                return (
                  <li key={option.id} className="rounded-md border border-border bg-surface">
                    <div className="flex flex-wrap items-center gap-1.5 p-1.5">
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          aria-label={`Move ${option.label} up`}
                          disabled={!canEdit || index === 0}
                          onClick={() => move(index, -1)}
                          className="text-faint-foreground hover:text-foreground disabled:opacity-[var(--disabled-opacity)]"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${option.label} down`}
                          disabled={!canEdit || index === draft.options.length - 1}
                          onClick={() => move(index, 1)}
                          className="text-faint-foreground hover:text-foreground disabled:opacity-[var(--disabled-opacity)]"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                      </div>

                      <Input
                        value={option.label}
                        aria-label="Option label"
                        readOnly={!canEdit}
                        onChange={(event) => patchOption(option.id, { label: event.target.value })}
                        className={cn("h-7 w-40 text-ui", option.isDisabled && "is-disabled")}
                      />

                      <Select
                        size="sm"
                        aria-label={`Colour for ${option.label}`}
                        isDisabled={!canEdit}
                        options={COLOUR_OPTIONS}
                        value={option.color}
                        onValueChange={(value) =>
                          value && patchOption(option.id, { color: value as SelectColor })
                        }
                        className="w-28"
                      />

                      <label className="flex items-center gap-1 text-body text-muted-foreground">
                        <Checkbox
                          checked={!option.isDisabled}
                          disabled={!canEdit}
                          aria-label={`Enable ${option.label}`}
                          onChange={(event) =>
                            patchOption(option.id, { isDisabled: !event.target.checked })
                          }
                        />
                        Enabled
                      </label>

                      <label
                        className="flex items-center gap-1 text-body text-muted-foreground"
                        title="Subtask progress counts records sitting on a completed option"
                      >
                        <Checkbox
                          checked={isCompleted}
                          disabled={!canEdit}
                          aria-label={`${option.label} means completed`}
                          onChange={() => toggleCompleted(option.id)}
                        />
                        <CircleCheck
                          className={cn("size-3", isCompleted ? "text-success" : "text-faint-foreground")}
                        />
                        Completed
                      </label>

                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant={isExpanded ? "subtle" : "ghost"}
                            className="ml-auto h-6 gap-1 px-1.5 text-body"
                            onClick={() =>
                              setExpanded(
                                isExpanded ? null : { columnId: column.id, optionId: option.id },
                              )
                            }
                          >
                            <Settings2 />
                            {isConditionGroupEmpty(option.availability) ? "Add rule" : "Edit rule"}
                          </Button>

                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete ${option.label}`}
                            onClick={() => removeOption(option.id)}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>

                    {rule && !isExpanded && (
                      <p className="border-t border-hairline px-2 py-1 text-body text-muted-foreground">
                        Available when {rule}
                      </p>
                    )}

                    {isExpanded && (
                      <div className="space-y-1.5 border-t border-hairline p-2">
                        <p className="text-body text-muted-foreground">
                          “{option.label}” is only offered when these hold for the record being
                          edited.
                        </p>
                        <ConditionBuilder
                          group={option.availability ?? makeConditionGroup(`grp_${option.id}`)}
                          columns={columns}
                          people={people}
                          onChange={(group) => patchOption(option.id, { availability: group })}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {draft.options.length === 0 && (
              <p className="text-ui text-faint-foreground">
                No options yet. Add the first one to start.
              </p>
            )}
          </section>

          <section className="space-y-1.5">
            <h3 className="text-ui font-medium text-foreground">
              Options a record does not qualify for
            </h3>
            <SelectField
              aria-label="Unavailable option behaviour"
              disabled={!canEdit}
              value={draft.unavailableBehavior}
              onChange={(event) =>
                patch({ unavailableBehavior: event.target.value as UnavailableOptionBehavior })
              }
              className="w-64"
            >
              <option value="disabled">Show them, disabled, with the reason</option>
              <option value="hidden">Hide them entirely</option>
            </SelectField>
            <p className="text-body text-faint-foreground">
              Disabled is usually kinder: it tells the reader what is missing instead of leaving
              them wondering where an option went.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-ui font-medium text-foreground">Transition rules</h3>
            <TransitionRulesEditor
              options={draft.options}
              rules={draft.transitionRules}
              columnName={column.name}
              canEdit={canEdit}
              onChange={(transitionRules) => patch({ transitionRules })}
            />
          </section>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">
          <span className="metric text-body text-faint-foreground">
            Rules apply wherever the value is written — the grid, the drawer and Kanban alike.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={close}
          >
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                onSave({
                  ...draft,
                  transitionRules: pruneTransitionRules(draft.transitionRules, draft.options),
                });
                close();
              }}
            >
              Save changes
            </Button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
