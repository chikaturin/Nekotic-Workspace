"use client";

import { GanttChartSquare } from "lucide-react";
import { FormField } from "@/components/ui/field";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn } from "@/types";

interface GanttSetupProps {
  readonly columns: readonly BoardColumn[];
  readonly startColumnId: string | null;
  readonly endColumnId: string | null;
}

const NOT_SET_OPTION: ListboxOption = { value: "", label: "Not set" };

export function GanttSetup({ columns, startColumnId, endColumnId }: GanttSetupProps) {
  const setDateColumn = useBoardStore((state) => state.setDateColumn);
  const setEndDateColumn = useBoardStore((state) => state.setEndDateColumn);
  const dateColumns = columns.filter((column) => column.type === "date");

  const dateOptions: readonly ListboxOption[] = [
    NOT_SET_OPTION,
    ...dateColumns.map((column) => ({ value: column.id, label: column.name })),
  ];

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-center">
        <GanttChartSquare className="mx-auto size-8 text-faint-foreground" strokeWidth={1.5} />

        <h2 className="mt-3 text-lead font-semibold text-foreground">
          Gantt needs a start and an end date
        </h2>
        <p className="mt-1 text-ui text-muted-foreground">
          {dateColumns.length > 0
            ? "Pick the two Date columns the bars should run between."
            : "This board has no Date column yet. Add one, then choose it here."}
        </p>

        {dateColumns.length > 0 && (
          <div className="mt-4 space-y-2 text-left">
            <FormField label="Start date">
              {(field) => (
                <Select
                  id={field.id}
                  aria-describedby={field["aria-describedby"]}
                  aria-label="Start date column"
                  options={dateOptions}
                  value={startColumnId ?? ""}
                  onValueChange={(value) => void setDateColumn(value || null)}
                  className="w-full"
                />
              )}
            </FormField>

            <FormField label="End date">
              {(field) => (
                <Select
                  id={field.id}
                  aria-describedby={field["aria-describedby"]}
                  aria-label="End date column"
                  options={dateOptions}
                  value={endColumnId ?? ""}
                  onValueChange={(value) => void setEndDateColumn(value || null)}
                  className="w-full"
                />
              )}
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}
