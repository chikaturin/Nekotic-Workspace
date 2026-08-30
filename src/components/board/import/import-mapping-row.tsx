"use client";

import { ArrowRight, CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { columnLabel } from "@/lib/grid";
import { typeDescription, typeLabel } from "@/lib/import-column-types";
import { cn } from "@/lib/utils";
import type { BoardColumn, ColumnType, MappingTarget } from "@/types";

const SAMPLE_COUNT = 3;

export const IGNORE_VALUE = "__ignore__";
export const CREATE_VALUE = "__create__";

interface ImportMappingRowProps {
  readonly header: string;
  readonly sourceIndex: number;
  readonly samples: readonly string[];
  readonly target: MappingTarget;
  readonly targetColumn: BoardColumn | null;
  readonly conflict: string | undefined;
  readonly targetOptions: readonly ListboxOption[];
  readonly typeOptions: readonly ListboxOption[];
  readonly onSetTarget: (sourceIndex: number, target: MappingTarget) => void;
}

export function ImportMappingRow({
  header,
  sourceIndex,
  samples,
  target,
  targetColumn,
  conflict,
  targetOptions,
  typeOptions,
  onSetTarget,
}: ImportMappingRowProps) {
  const isIgnored = target.kind === "ignore";

  function handleTargetChange(value: string | null) {
    if (value === null || value === IGNORE_VALUE) {
      onSetTarget(sourceIndex, { kind: "ignore" });
      return;
    }

    if (value === CREATE_VALUE) {
      onSetTarget(sourceIndex, { kind: "create", name: header.trim(), type: "text" });
      return;
    }

    onSetTarget(sourceIndex, { kind: "existing", columnId: value });
  }

  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5 transition-colors",
        conflict
          ? "border-danger/50 bg-danger/5"
          : isIgnored
            ? "border-border bg-transparent"
            : "border-border bg-surface",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className={cn("min-w-0 flex-1 basis-56", isIgnored && "is-disabled")}>
          <p className="flex items-baseline gap-1.5">
            <span className="metric shrink-0 text-body text-faint-foreground">
              {columnLabel(sourceIndex)}
            </span>
            <span className="min-w-0 truncate text-ui font-medium text-foreground" title={header}>
              {header}
            </span>
          </p>

          <p className="mt-1 truncate text-body text-muted-foreground" title={samples.join(" · ")}>
            {samples.length > 0 ? samples.join("  ·  ") : "No values in this column"}
          </p>
        </div>

        <ArrowRight
          className={cn(
            "mt-1.5 size-3.5 shrink-0",
            "text-faint-foreground",
            isIgnored && "is-disabled",
          )}
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <Select
            options={targetOptions}
            value={
              target.kind === "existing"
                ? target.columnId
                : target.kind === "create"
                  ? CREATE_VALUE
                  : IGNORE_VALUE
            }
            aria-label={`Where “${header}” goes`}
            isSearchable
            size="sm"
            onValueChange={handleTargetChange}
          />

          {target.kind === "create" && (
            <div className="flex flex-wrap gap-1.5">
              <Input
                value={target.name}
                aria-label={`Name for the column created from “${header}”`}
                placeholder="Column name"
                className="h-[var(--control-sm)] min-w-0 flex-1 basis-32 text-ui"
                onChange={(event) =>
                  onSetTarget(sourceIndex, { ...target, name: event.target.value })
                }
              />
              <Select
                options={typeOptions}
                value={target.type}
                aria-label={`Cell type for the column created from “${header}”`}
                size="sm"
                className="flex-1 basis-36"
                onValueChange={(value) =>
                  value && onSetTarget(sourceIndex, { ...target, type: value as ColumnType })
                }
              />
            </div>
          )}

          <p className="text-body text-faint-foreground">
            {describeTarget(target, targetColumn)}
          </p>
        </div>
      </div>

      {conflict && (
        <p className="mt-2 flex items-start gap-1.5 text-body text-danger">
          <CircleAlert className="mt-0.5 size-3 shrink-0" />
          {conflict}
        </p>
      )}
    </li>
  );
}

function describeTarget(target: MappingTarget, column: BoardColumn | null): string {
  if (target.kind === "ignore") return "Left out — nothing from this column is imported";

  if (target.kind === "create") {
    return `New column · ${typeLabel(target.type)} — ${typeDescription(target.type)}`;
  }

  if (!column) return "Writes into a column on the board";

  return `Existing column · ${typeLabel(column.type)} — ${typeDescription(column.type)}`;
}

export function samplesFor(
  rows: readonly { readonly cells: readonly string[] }[],
  sourceIndex: number,
): readonly string[] {
  const seen = new Set<string>();

  for (const row of rows) {
    const value = (row.cells[sourceIndex] ?? "").trim();
    if (value === "" || seen.has(value)) continue;

    seen.add(value);
    if (seen.size === SAMPLE_COUNT) break;
  }

  return [...seen];
}
