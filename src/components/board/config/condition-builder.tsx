"use client";

import { Plus, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import type { ListboxOption } from "@/components/ui/listbox";
import { MultiSelect, Select } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import { columnVisual } from "@/lib/board-visuals";
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
  readonly depth?: number;
  readonly onRemove?: () => void;
}

const CONTROL_SIZE = "sm" as const;

let seed = 0;
const nextId = (prefix: string): string => `${prefix}_${(seed += 1).toString(36)}`;

export function ConditionBuilder({
  group,
  columns,
  people,
  onChange,
  depth = 0,
  onRemove,
}: ConditionBuilderProps) {
  const isEmpty = group.conditions.length === 0 && group.groups.length === 0;

  const columnOptions = useMemo<readonly ListboxOption[]>(
    () =>
      columns.map((column) => ({
        value: column.id,
        label: column.name,
        icon: columnVisual(column.type).Icon,
      })),
    [columns],
  );

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

              <Select
                aria-label="Field"
                size={CONTROL_SIZE}
                isSearchable
                options={columnOptions}
                value={condition.columnId}
                onValueChange={(value) => {
                  const next = columns.find((item) => item.id === value);
                  if (!next) return;
                  patch(condition.id, {
                    columnId: next.id,
                    operator: reconcileConditionOperator(next.type, condition.operator),
                    value: "",
                    values: [],
                  });
                }}
                className="w-32 shrink-0"
              />

              <SelectField
                aria-label="Condition"
                size={CONTROL_SIZE}
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
        <Button size="xs" variant="ghost" className="gap-1" onClick={addCondition}>
          <Plus />
          Add condition
        </Button>
        {depth === 0 && (
          <Button size="xs" variant="ghost" className="gap-1" onClick={addGroup}>
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
        size={CONTROL_SIZE}
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

function ConditionValue({ condition, column, people, onChange }: ConditionValueProps) {
  if (!column) return <span className="min-w-0 flex-1" />;

  const arity = valueArityFor(condition.operator);
  if (arity === "none") {
    return <span className="min-w-0 flex-1 text-body text-faint-foreground">—</span>;
  }

  if (column.type === "select") {
    const options: readonly ListboxOption[] = column.config.options.map((option) => ({
      value: option.id,
      label: option.label,
      color: option.color,
    }));

    if (arity === "list") {
      return (
        <MultiSelect
          aria-label="Value"
          size={CONTROL_SIZE}
          placeholder="Choose…"
          options={options}
          values={condition.values ?? []}
          onValuesChange={(values) => onChange({ values, value: values[0] ?? "" })}
          className="min-w-0 flex-1"
        />
      );
    }

    return (
      <Select
        aria-label="Value"
        size={CONTROL_SIZE}
        isSearchable
        isClearable
        placeholder="Choose…"
        options={options}
        value={condition.value === "" ? null : condition.value}
        onValueChange={(value) => onChange({ value: value ?? "", values: [] })}
        className="min-w-0 flex-1"
      />
    );
  }

  if (column.type === "user") {
    return (
      <Select
        aria-label="Value"
        size={CONTROL_SIZE}
        isSearchable
        isClearable
        placeholder="Choose…"
        options={people.map((person) => ({
          value: person.id,
          label: person.isActive ? person.name : `${person.name} (inactive)`,
        avatarUrl: person.avatarUrl ?? "",
        }))}
        value={condition.value === "" ? null : condition.value}
        onValueChange={(value) => onChange({ value: value ?? "" })}
        className="min-w-0 flex-1"
      />
    );
  }

  if (column.type === "date") {
    return (
      <DatePicker
        aria-label="Value"
        size={CONTROL_SIZE}
        value={condition.value === "" ? null : condition.value}
        onChange={(day) => onChange({ value: day ?? "" })}
        placeholder="Pick a date"
        clearable
        className="min-w-0 flex-1"
      />
    );
  }

  return (
    <Input
      type="text"
      aria-label="Value"
      size={CONTROL_SIZE}
      value={condition.value}
      placeholder="Value"
      onChange={(event) => onChange({ value: event.target.value })}
      className="min-w-0 flex-1"
    />
  );
}
