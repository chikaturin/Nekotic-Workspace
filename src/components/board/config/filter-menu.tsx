"use client";

import { Filter, Plus, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import {
  makeFilter,
  OPERATOR_LABELS,
  operatorsFor,
  reconcileOperator,
  valueKindFor,
} from "@/lib/board-filters";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn, DirectoryUser, FilterOperator, ViewFilter } from "@/types";

/**
 * Filter engine UI. Conditions are stored on the saved view, so the same set
 * applies to the table, Kanban, calendar and timeline without being re-entered.
 */
export function FilterMenu({ model }: { model: BoardViewModel }) {
  const { view, columns } = model;
  const setFilters = useBoardStore((state) => state.setFilters);
  const setConjunction = useBoardStore((state) => state.setFilterConjunction);
  const people = useBoardStore((state) => state.people);

  const filters = useMemo<readonly ViewFilter[]>(() => view?.filters ?? [], [view?.filters]);

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
          {filters.length > 0 && <Badge variant="count">{filters.length}</Badge>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[34rem] max-w-[calc(100vw-2rem)]">
        {filters.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-faint-foreground">
            No conditions yet. Records are shown as they come.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filters.map((filter, index) => {
              const column = columns.find((candidate) => candidate.id === filter.columnId);

              return (
                <li key={filter.id} className="flex items-center gap-1.5">
                  <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                    {index === 0 ? (
                      "Where"
                    ) : index === 1 ? (
                      <SelectField
                        aria-label="Combine conditions"
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

                  <SelectField
                    aria-label="Column"
                    value={filter.columnId}
                    onChange={(event) => {
                      const next = columns.find((item) => item.id === event.target.value);
                      if (!next) return;
                      update(filter.id, {
                        columnId: next.id,
                        operator: reconcileOperator(next, filter.operator),
                        value: "",
                      });
                    }}
                    className="w-32 flex-shrink-0"
                  >
                    {columns.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    aria-label="Condition"
                    value={filter.operator}
                    onChange={(event) =>
                      update(filter.id, { operator: event.target.value as FilterOperator })
                    }
                    className="w-36 flex-shrink-0"
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
              className="ml-auto text-[11px]"
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

/** The value control follows the column's type, not the operator alone. */
function FilterValue({ filter, column, people, onChange }: FilterValueProps) {
  if (!column) return <span className="flex-1" />;

  const kind = valueKindFor(column, filter.operator);

  if (kind === "none") {
    return <span className="flex-1 text-[11px] text-faint-foreground">—</span>;
  }

  if (kind === "option" && column.type === "select") {
    return (
      <SelectField
        aria-label="Value"
        value={filter.value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1"
      >
        <option value="">Choose…</option>
        {column.config.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
    );
  }

  if (kind === "user") {
    return (
      <SelectField
        aria-label="Value"
        value={filter.value}
        onChange={(event) => onChange(event.target.value)}
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
      type={kind === "date" ? "date" : "text"}
      aria-label="Value"
      value={filter.value}
      placeholder="Value"
      onChange={(event) => onChange(event.target.value)}
      className="h-7 min-w-0 flex-1 text-[12px]"
    />
  );
}
