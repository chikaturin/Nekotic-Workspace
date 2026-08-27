"use client";

import { GanttChartSquare } from "lucide-react";
import { SelectField } from "@/components/ui/select-field";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn } from "@/types";

interface GanttSetupProps {
  readonly columns: readonly BoardColumn[];
  readonly startColumnId: string | null;
  readonly endColumnId: string | null;
}

/**
 * What the Gantt shows before it can show anything.
 *
 * A board's date columns are its own — there is no `startDate` field to assume —
 * so the chart asks which two to read rather than guessing, and the pickers are
 * here rather than behind a menu because choosing them *is* the next step.
 * They write to the same saved view the config bar's Dates menu does.
 */
export function GanttSetup({ columns, startColumnId, endColumnId }: GanttSetupProps) {
  const setDateColumn = useBoardStore((state) => state.setDateColumn);
  const setEndDateColumn = useBoardStore((state) => state.setEndDateColumn);
  const dateColumns = columns.filter((column) => column.type === "date");

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-center">
        <GanttChartSquare className="mx-auto size-8 text-faint-foreground" strokeWidth={1.5} />

        <h2 className="mt-3 text-[14px] font-semibold text-foreground">
          Gantt needs a start and an end date
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {dateColumns.length > 0
            ? "Pick the two Date columns the bars should run between."
            : "This board has no Date column yet. Add one, then choose it here."}
        </p>

        {dateColumns.length > 0 && (
          <div className="mt-4 space-y-2 text-left">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Start date</span>
              <SelectField
                aria-label="Start date column"
                value={startColumnId ?? ""}
                onChange={(event) => void setDateColumn(event.target.value || null)}
                className="w-full"
              >
                <option value="">Not set</option>
                {dateColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </SelectField>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">End date</span>
              <SelectField
                aria-label="End date column"
                value={endColumnId ?? ""}
                onChange={(event) => void setEndDateColumn(event.target.value || null)}
                className="w-full"
              >
                <option value="">Not set</option>
                {dateColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
