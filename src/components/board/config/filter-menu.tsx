"use client";

import { Filter, Plus, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CountBadge } from "@/components/ui/badge";
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

/**
 * One step for every control in a condition row. A row mixing a 32px picker
 * with a 28px input reads as two rows that happen to be on the same line, and
 * the four controls here were previously split across both heights.
 */
const CONTROL_SIZE = "sm" as const;

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

  /**
   * The type icon is the reason this one picker is not native: a column list of
   * bare names says nothing about which entries will offer "is before" and
   * which will offer "contains", and the operator list below only makes sense
   * once you can see what kind of column it belongs to.
   */
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
                    // A board carries dozens of columns and the native select
                    // this replaces had the platform's typeahead; the search
                    // field is what hands that back rather than dropping it.
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

                  {/* The operators are a plain list of words, so this one stays
                      native: it keeps the platform's keyboard and adds no
                      second portal inside an already-open popover. */}
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

/** The value control follows the column's type, not the operator alone. */
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
        // "Choose…" used to be a real <option>, and picking it wrote "" back.
        // The placeholder plus the clear button are the same two states — an
        // empty filter is still expressible, just not as a fake option.
        isClearable
        placeholder="Choose…"
        options={column.config.options.map((option) => ({
          value: option.id,
          label: option.label,
          color: option.color,
          // `isDisabled` is deliberately not carried over. It means "no longer
          // offered for data entry", and filtering for a retired status is
          // exactly how you find the records still holding one.
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
          // The inactive marker stays in the label rather than moving to a
          // description, because the trigger only ever shows the label and
          // "who is this filtered to" should not need the list reopened.
          label: person.isActive ? person.name : `${person.name} (inactive)`,
          // Empty rather than undefined: the visual branches on
        // presence, and an absent url would drop the row to no
        // glyph at all instead of falling back to initials.
        avatarUrl: person.avatarUrl ?? "",
        }))}
        value={filter.value === "" ? null : filter.value}
        onValueChange={(value) => onChange(value ?? "")}
        className="min-w-0 flex-1"
      />
    );
  }

  if (kind === "date") {
    // The filter already stores `YYYY-MM-DD`, which is exactly what the picker
    // speaks, so nothing is converted on the way in or out — and the day the
    // rule compares against is the day that was clicked, in every timezone.
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
