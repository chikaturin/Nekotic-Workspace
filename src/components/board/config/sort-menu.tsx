"use client";

import { ArrowDownUp, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useBoardStore } from "@/store/board-store";
import type { ViewSort } from "@/types";

/**
 * Multi-level sort. Level order is the tie-break order — the first entry
 * decides, later ones only settle ties, which is what `compareRows` walks.
 */
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
          {sorts.length > 0 && <Badge variant="count">{sorts.length}</Badge>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[26rem] max-w-[calc(100vw-2rem)]">
        {sorts.length === 0 ? (
          <p className="px-1 py-2 text-ui text-faint-foreground">
            Records follow the order the board stores them in.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {sorts.map((sort, index) => (
              <li key={sort.columnId} className="flex items-center gap-1.5">
                <span className="metric w-10 shrink-0 text-body text-faint-foreground">
                  {index === 0 ? "Sort" : "then"}
                </span>

                <SelectField
                  aria-label={`Sort level ${index + 1} column`}
                  value={sort.columnId}
                  onChange={(event) => update(index, { columnId: event.target.value })}
                  className="min-w-0 flex-1"
                >
                  {[...columns]
                    .filter((column) => column.id === sort.columnId || !used.has(column.id))
                    .map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                </SelectField>

                <SelectField
                  aria-label={`Sort level ${index + 1} direction`}
                  value={sort.direction}
                  onChange={(event) =>
                    update(index, { direction: event.target.value === "desc" ? "desc" : "asc" })
                  }
                  className="w-28 flex-shrink-0"
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
            ))}
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
