"use client";

import { ArrowDownUp, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { columnVisual } from "@/lib/board-visuals";
import { useBoardStore } from "@/store/board-store";
import type { ViewSort } from "@/types";

const CONTROL_SIZE = "sm" as const;

export function SortMenu({ model }: { model: BoardViewModel }) {
  const { view, columns } = model;
  const setSorts = useBoardStore((state) => state.setSorts);

  const sorts = view?.sorts ?? [];
  const used = new Set(sorts.map((sort) => sort.columnId));
  const available = columns.filter((column) => !used.has(column.id));

  function update(index: number, patch: Partial<ViewSort>) {
    void setSorts(sorts.map((sort, position) => (position === index ? { ...sort, ...patch } : sort)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sorts.length) return;

    const next = [...sorts];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);

    void setSorts(next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={sorts.length > 0 ? "subtle" : "ghost"} className="gap-1.5">
          <ArrowDownUp />
          Sort
          {sorts.length > 0 && <CountBadge>{sorts.length}</CountBadge>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[26rem] max-w-[calc(100vw-2rem)]">
        {sorts.length === 0 ? (
          <p className="px-1 py-2 text-ui text-faint-foreground">
            Records follow the order the board stores them in.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {sorts.map((sort, index) => {
              const levelOptions = columns
                .filter((column) => column.id === sort.columnId || !used.has(column.id))
                .map((column) => ({
                  value: column.id,
                  label: column.name,
                  icon: columnVisual(column.type).Icon,
                }));

              return (
                <li key={sort.columnId} className="flex items-center gap-1.5">
                  <span className="metric w-10 shrink-0 text-body text-faint-foreground">
                    {index === 0 ? "Sort" : "then"}
                  </span>

                  <Select
                    aria-label={`Sort level ${index + 1} column`}
                    size={CONTROL_SIZE}
                    isSearchable
                    options={levelOptions}
                    value={sort.columnId}
                    onValueChange={(value) => {
                      if (value === null) return;
                      update(index, { columnId: value });
                    }}
                    className="min-w-0 flex-1"
                  />

                  <SelectField
                    aria-label={`Sort level ${index + 1} direction`}
                    size={CONTROL_SIZE}
                    value={sort.direction}
                    onChange={(event) =>
                      update(index, { direction: event.target.value === "desc" ? "desc" : "asc" })
                    }
                    className="w-28 shrink-0"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </SelectField>

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move level up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move level down"
                    disabled={index === sorts.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove sort level"
                    onClick={() => void setSorts(sorts.filter((_, position) => position !== index))}
                  >
                    <X />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-2 flex items-center gap-1 border-t border-hairline pt-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={available.length === 0}
            onClick={() => {
              const column = available[0];
              if (column) void setSorts([...sorts, { columnId: column.id, direction: "asc" }]);
            }}
          >
            <Plus />
            Add level
          </Button>

          {sorts.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-body"
              onClick={() => void setSorts([])}
            >
              Clear
            </Button>
          )}
        </div>

        <p className="mt-2 px-1 text-body text-faint-foreground">
          Empty values always sort last, whichever direction is chosen.
        </p>
      </PopoverContent>
    </Popover>
  );
}
