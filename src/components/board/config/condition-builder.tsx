"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  conditionOperatorsFor,
  makeCondition,
  makeConditionGroup,
  OPERATOR_LABELS,
  reconcileConditionOperator,
  valueArityFor,
  withCondition,
  withConditionPatched,
  withGroup,
  withGroupPatched,
  withoutCondition,
  withoutGroup,
} from "@/lib/conditions";
import { cn } from "@/lib/utils";
import type {
  BoardColumn,
  Condition,
  ConditionGroup,
  ConditionOperator,
  DirectoryUser,
} from "@/types";

interface ConditionBuilderProps {
  readonly group: ConditionGroup;
  readonly columns: readonly BoardColumn[];
  readonly people: readonly DirectoryUser[];
  readonly onChange: (group: ConditionGroup) => void;
  /** Nested groups indent; the root does not. */
  readonly depth?: number;
  readonly onRemove?: () => void;
}

let seed = 0;
const nextId = (prefix: string): string => `${prefix}_${(seed += 1).toString(36)}`;

/**
 * AND/OR condition builder, one level of nesting per group.
 *
 * It edits a `ConditionGroup` and nothing else — the same shape the evaluator
 * in `lib/conditions` reads — so the same builder can drive conditional select
 * options today and any other rule that needs "when is this true?" later.
 */
export function ConditionBuilder({
  group,
  columns,
  people,
  onChange,
  depth = 0,
  onRemove,
}: ConditionBuilderProps) {
  const isEmpty = group.conditions.length === 0 && group.groups.length === 0;

  function addCondition() {
    const column = columns[0];
    if (!column) return;
    onChange(withCondition(group, makeCondition(column, nextId("cnd"))));
  }

  function addGroup() {
    onChange(withGroup(group, makeConditionGroup(nextId("grp"))));
  }

  function patch(conditionId: string, changes: Partial<Condition>) {
    onChange(withConditionPatched(group, conditionId, changes));
  }

  return (
    <div
      className={cn(
        "space-y-1.5",
        depth > 0 && "rounded-md border border-hairline bg-canvas/60 p-2",
      )}
    >
      {depth > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-body text-faint-foreground">Group</span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove condition group"
            onClick={onRemove}
            className="ml-auto"
          >
            <X />
          </Button>
        </div>
      )}

      {isEmpty && (
        <p className="text-body text-faint-foreground">
          No conditions — this option is always available.
        </p>
      )}

      <ul className="space-y-1.5">
        {group.conditions.map((condition, index) => {
          const column = columns.find((candidate) => candidate.id === condition.columnId);

          return (
            <li key={condition.id} className="flex flex-wrap items-center gap-1.5">
              <Conjunction
                index={index}
                group={group}
                onChange={(conjunction) => onChange({ ...group, conjunction })}
              />

              <SelectField
                aria-label="Field"
                value={condition.columnId}
                onChange={(event) => {
                  const next = columns.find((item) => item.id === event.target.value);
                  if (!next) return;
                  patch(condition.id, {
                    columnId: next.id,
                    operator: reconcileConditionOperator(next.type, condition.operator),
                    value: "",
                    values: [],
                  });
                }}
                className="w-32 shrink-0"
              >
                {columns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                aria-label="Condition"
                value={condition.operator}
                onChange={(event) =>
                  patch(condition.id, { operator: event.target.value as ConditionOperator })
                }
                className="w-36 shrink-0"
              >
                {conditionOperatorsFor(column?.type ?? "text").map((operator) => (
                  <option key={operator} value={operator}>
                    {OPERATOR_LABELS[operator]}
                  </option>
                ))}
              </SelectField>

              <ConditionValue
                condition={condition}
                column={column}
                people={people}
                onChange={(changes) => patch(condition.id, changes)}
              />

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove condition"
                onClick={() => onChange(withoutCondition(group, condition.id))}
              >
                <X />
              </Button>
            </li>
          );
        })}
      </ul>

      {group.groups.map((nested) => (
        <ConditionBuilder
          key={nested.id}
          group={nested}
          columns={columns}
          people={people}
          depth={depth + 1}
          onChange={(next) => onChange(withGroupPatched(group, nested.id, next))}
          onRemove={() => onChange(withoutGroup(group, nested.id))}
        />
      ))}

      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-body" onClick={addCondition}>
          <Plus />
          Add condition
        </Button>
        {/* One level of nesting is enough for `A and (B or C)`; more is a
            workflow engine, which this deliberately is not. */}
        {depth === 0 && (
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-body" onClick={addGroup}>
            <Plus />
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}

function Conjunction({
  index,
  group,
  onChange,
}: {
  readonly index: number;
  readonly group: ConditionGroup;
  readonly onChange: (conjunction: ConditionGroup["conjunction"]) => void;
}) {
  if (index === 0) {
    return <span className="w-14 shrink-0 text-body text-muted-foreground">When</span>;
  }

  if (index === 1) {
    return (
      <SelectField
        aria-label="Combine conditions"
        value={group.conjunction}
        onChange={(event) => onChange(event.target.value === "or" ? "or" : "and")}
        className="w-14 shrink-0"
      >
        <option value="and">and</option>
        <option value="or">or</option>
      </SelectField>
    );
  }

  return (
    <span className="w-14 shrink-0 pl-1.5 text-body text-muted-foreground">
      {group.conjunction}
    </span>
  );
}

interface ConditionValueProps {
  readonly condition: Condition;
  readonly column: BoardColumn | undefined;
  readonly people: readonly DirectoryUser[];
  readonly onChange: (changes: Partial<Condition>) => void;
}

/** The value control follows the column's type and the operator's arity. */
function ConditionValue({ condition, column, people, onChange }: ConditionValueProps) {
  if (!column) return <span className="min-w-0 flex-1" />;

  const arity = valueArityFor(condition.operator);
  if (arity === "none") {
    return <span className="min-w-0 flex-1 text-body text-faint-foreground">—</span>;
  }

  if (column.type === "select") {
    const selected = arity === "list" ? (condition.values ?? []) : [condition.value];

    return (
      <SelectField
        multiple={arity === "list"}
        aria-label="Value"
        value={arity === "list" ? [...selected] : condition.value}
        onChange={(event) => {
          const picked = [...event.target.selectedOptions].map((option) => option.value);
          onChange(
            arity === "list"
              ? { values: picked, value: picked[0] ?? "" }
              : { value: event.target.value, values: [] },
          );
        }}
        className={cn("min-w-0 flex-1", arity === "list" && "h-16")}
      >
        {arity === "single" && <option value="">Choose…</option>}
        {column.config.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
    );
  }

  if (column.type === "user") {
    return (
      <SelectField
        aria-label="Value"
        value={condition.value}
        onChange={(event) => onChange({ value: event.target.value })}
        className="min-w-0 flex-1"
      >
        <option value="">Choose…</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.isActive ? person.name : `${person.name} (inactive)`}
          </option>
        ))}
      </SelectField>
    );
  }

  return (
    <Input
      type={column.type === "date" ? "date" : "text"}
      aria-label="Value"
      value={condition.value}
      placeholder="Value"
      onChange={(event) => onChange({ value: event.target.value })}
      className="h-7 min-w-0 flex-1 text-ui"
    />
  );
}
