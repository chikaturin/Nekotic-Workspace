"use client";

import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useBoardStore } from "@/store/board-store";

/** Which date columns the calendar and the timeline anchor on. */
export function DateMenu({ model }: { model: BoardViewModel }) {
  const { view, columns } = model;
  const setDateColumn = useBoardStore((state) => state.setDateColumn);
  const setEndDateColumn = useBoardStore((state) => state.setEndDateColumn);

  const dateColumns = columns.filter((column) => column.type === "date");
  const isTimeline = view?.type === "gantt";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <CalendarRange />
          Dates
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <label className="flex items-center gap-2 px-1 py-1">
          <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
            {isTimeline ? "Start" : "Date"}
          </span>
          <SelectField
            value={view?.dateColumnId ?? ""}
            onChange={(event) => void setDateColumn(event.target.value || null)}
            className="min-w-0 flex-1"
          >
            <option value="">None</option>
            {dateColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </SelectField>
        </label>

        {isTimeline && (
          <label className="flex items-center gap-2 px-1 py-1">
            <span className="w-16 shrink-0 text-[11px] text-muted-foreground">End</span>
            <SelectField
              value={view?.endDateColumnId ?? ""}
              onChange={(event) => void setEndDateColumn(event.target.value || null)}
              className="min-w-0 flex-1"
            >
              <option value="">None</option>
              {dateColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </SelectField>
          </label>
        )}

        {dateColumns.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-faint-foreground">
            This board has no Date column yet. Add one from the table header.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
