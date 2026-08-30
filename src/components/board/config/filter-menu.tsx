"use client";

import { Filter, Plus, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CountBadge } from "@/components/ui/badge";
import { useBoardPeople } from "@/hooks/use-board-people";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import type { ListboxOption } from "@/components/ui/listbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import {
  makeFilter,
  OPERATOR_LABELS,
  operatorsFor,
  reconcileOperator,
  valueKindFor,
} from "@/lib/board-filters";
import { columnVisual } from "@/lib/board-visuals";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn, DirectoryUser, FilterOperator, ViewFilter } from "@/types";

const CONTROL_SIZE = "sm" as const;

export function FilterMenu({ model }: { model: BoardViewModel }) {
  const { view, columns } = model;
  const setFilters = useBoardStore((state) => state.setFilters);
  const setConjunction = useBoardStore((state) => state.setFilterConjunction);
  const people = useBoardPeople();

  const filters = useMemo<readonly ViewFilter[]>(() => view?.filters ?? [], [view?.filters]);

  const columnOptions = useMemo<readonly ListboxOption[]>(
    () =>
      columns.map((column) => ({
        value: column.id,
        label: column.name,
        icon: columnVisual(column.type).Icon,
      })),
    [columns],
  );

  const update = useCallback(
    (id: string, patch: Partial<ViewFilter>) => {
      void setFilters(
        filters.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
      );
    },
    [filters, setFilters],
  );

  function addCondition() {
    const column = columns.find((candidate) => !candidate.hidden) ?? columns[0];
    if (!column) return;

    void setFilters([...filters, makeFilter(column, `flt_${filters.length}_${column.id}`)]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={filters.length > 0 ? "subtle" : "ghost"} className="gap-1.5">
          <Filter />
          Filter
          {filters.length > 0 && <CountBadge>{filters.length}</CountBadge>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[34rem] max-w-[calc(100vw-2rem)]">
        {filters.length === 0 ? (
          <p className="px-1 py-2 text-ui text-faint-foreground">
            No conditions yet. Records are shown as they come.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filters.map((filter, index) => {
              const column = columns.find((candidate) => candidate.id === filter.columnId);

              return (
                <li key={filter.id} className="flex items-center gap-1.5">
                  <span className="w-16 shrink-0 text-body text-muted-foreground">
                    {index === 0 ? (
                      "Where"
                    ) : index === 1 ? (
                      <SelectField
                        aria-label="Combine conditions"
                        size={CONTROL_SIZE}
                        value={view?.filterConjunction ?? "and"}
                        onChange={(event) =>
                          void setConjunction(event.target.value === "or" ? "or" : "and")
                        }
                        className="w-full"
                      >
                        <option value="and">and</option>
                        <option value="or">or</option>
                      </SelectField>
                    ) : (
                      <span className="pl-1.5">{view?.filterConjunction ?? "and"}</span>
                    )}
                  </span>

                  <Select
                    aria-label="Column"
                    size={CONTROL_SIZE}
                    isSearchable
                    options={columnOptions}
                    value={filter.columnId}
                    onValueChange={(value) => {
                      const next = columns.find((item) => item.id === value);
                      if (!next) return;
                      update(filter.id, {
                        columnId: next.id,
                        operator: reconcileOperator(next, filter.operator),
                        value: "",
                      });
                    }}
                    className="w-32 shrink-0"
                  />

                  <SelectField
                    aria-label="Condition"
                    size={CONTROL_SIZE}
                    value={filter.operator}
                    onChange={(event) =>
                      update(filter.id, { operator: event.target.value as FilterOperator })
                    }
                    className="w-36 shrink-0"
                  >
                    {operatorsFor(column?.type ?? "text").map((operator) => (
                      <option key={operator} value={operator}>
                        {OPERATOR_LABELS[operator]}
                      </option>
                    ))}
                  </SelectField>

                  <FilterValue
                    filter={filter}
                    column={column}
                    people={people}
                    onChange={(value) => update(filter.id, { value })}
                  />

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove condition"
                    onClick={() =>
                      void setFilters(filters.filter((item) => item.id !== filter.id))
                    }
                  >
                    <X />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex items-center gap-1 border-t border-hairline pt-2">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={addCondition}>
            <Plus />
            Add condition
          </Button>

          {filters.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-body"
              onClick={() => void setFilters([])}
            >
              Clear all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterValueProps {
  readonly filter: ViewFilter;
  readonly column: BoardColumn | undefined;
  readonly people: readonly DirectoryUser[];
  readonly onChange: (value: string) => void;
}

function FilterValue({ filter, column, people, onChange }: FilterValueProps) {
  if (!column) return <span className="flex-1" />;

  const kind = valueKindFor(column, filter.operator);

  if (kind === "none") {
    return <span className="flex-1 text-body text-faint-foreground">—</span>;
  }

  if (kind === "option" && column.type === "select") {
    return (
      <Select
        aria-label="Value"
        size={CONTROL_SIZE}
        isSearchable
        isClearable
        placeholder="Choose…"
        options={column.config.options.map((option) => ({
          value: option.id,
          label: option.label,
          color: option.color,
        }))}
        value={filter.value === "" ? null : filter.value}
        onValueChange={(value) => onChange(value ?? "")}
        className="min-w-0 flex-1"
      />
    );
  }

  if (kind === "user") {
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
        value={filter.value === "" ? null : filter.value}
        onValueChange={(value) => onChange(value ?? "")}
        className="min-w-0 flex-1"
      />
    );
  }

  if (kind === "date") {
    return (
      <DatePicker
        aria-label="Value"
        size={CONTROL_SIZE}
        value={filter.value === "" ? null : filter.value}
        onChange={(day) => onChange(day ?? "")}
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
      value={filter.value}
      placeholder="Value"
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 flex-1"
    />
  );
}
