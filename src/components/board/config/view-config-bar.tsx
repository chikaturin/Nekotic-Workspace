"use client";

import { X } from "lucide-react";
import { DateMenu } from "@/components/board/config/date-menu";
import { FilterMenu } from "@/components/board/config/filter-menu";
import { GroupMenu } from "@/components/board/config/group-menu";
import { SortMenu } from "@/components/board/config/sort-menu";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { describeFilter } from "@/lib/board-filters";
import { useBoardStore } from "@/store/board-store";
import type { RowHeight } from "@/types";

const ROW_HEIGHTS: readonly RowHeight[] = ["short", "medium", "tall"];

/**
 * One configuration bar for every view type. Filter, sort and group are shared
 * by all four; the date anchors only appear where they mean something.
 */
export function ViewConfigBar({ model }: { model: BoardViewModel }) {
  const { view, columns } = model;
  const setFilters = useBoardStore((state) => state.setFilters);
  const setRowHeight = useBoardStore((state) => state.setRowHeight);

  const needsDates = view?.type === "calendar" || view?.type === "timeline";
  const filters = view?.filters ?? [];

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-hairline px-3 py-1.5">
      <FilterMenu model={model} />
      <SortMenu model={model} />
      {!needsDates && <GroupMenu model={model} />}
      {needsDates && <DateMenu model={model} />}

      {view?.type === "table" && (
        <SelectField
          aria-label="Row height"
          value={view.rowHeight}
          onChange={(event) => void setRowHeight(event.target.value as RowHeight)}
          className="ml-1 h-7"
        >
          {ROW_HEIGHTS.map((height) => (
            <option key={height} value={height}>
              {height[0]?.toUpperCase()}
              {height.slice(1)} rows
            </option>
          ))}
        </SelectField>
      )}

      {filters.length > 0 && (
        <div className="ml-2 flex min-w-0 flex-wrap items-center gap-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => void setFilters(filters.filter((item) => item.id !== filter.id))}
              className="flex max-w-56 items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] text-accent"
            >
              <span className="truncate">{describeFilter(filter, columns)}</span>
              <X className="size-2.5 shrink-0 opacity-70" />
            </button>
          ))}

          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px]"
            onClick={() => void setFilters([])}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
