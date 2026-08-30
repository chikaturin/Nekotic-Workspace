"use client";

import { Ban, Plus } from "lucide-react";
import { useMemo } from "react";
import { IMPORT_PREVIEW_ROWS } from "@/config/app";
import { Checkbox } from "@/components/ui/checkbox";
import type { ListboxOption } from "@/components/ui/listbox";
import { COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import { columnVisual } from "@/lib/board-visuals";
import {
  creationRefusalFor,
  importRefusalFor,
  typeDescription,
  typeLabel,
} from "@/lib/import-column-types";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CREATE_VALUE,
  IGNORE_VALUE,
  ImportMappingRow,
  samplesFor,
} from "@/components/board/import/import-mapping-row";
import {
  ImportPreviewFooter,
  ImportPreviewTable,
} from "@/components/board/import/import-preview-table";
import type {
  BoardColumn,
  ColumnMapping,
  ColumnType,
  ImportSource,
  MappingConflict,
  MappingTarget,
} from "@/types";

interface ImportMappingStepProps {
  readonly source: ImportSource;
  readonly columns: readonly BoardColumn[];
  readonly mappings: readonly ColumnMapping[];
  readonly conflicts: readonly MappingConflict[];
  readonly hasHeaderRow: boolean;
  readonly wasTruncated: boolean;
  readonly unmapped: readonly BoardColumn[];
  readonly isRemovingUnmapped: boolean;
  readonly onSetHeaderRow: (hasHeaderRow: boolean) => void;
  readonly onSetTarget: (sourceIndex: number, target: MappingTarget) => void;
  readonly onSetRemovingUnmapped: (remove: boolean) => void;
}

const TYPES = Object.keys(COLUMN_TYPE_LABELS) as readonly ColumnType[];

export function ImportMappingStep({
  source,
  columns,
  mappings,
  conflicts,
  hasHeaderRow,
  wasTruncated,
  unmapped,
  isRemovingUnmapped,
  onSetHeaderRow,
  onSetTarget,
  onSetRemovingUnmapped,
}: ImportMappingStepProps) {
  const preview = source.rows.slice(0, IMPORT_PREVIEW_ROWS);

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  const counts = useMemo(
    () => ({
      existing: mappings.filter((mapping) => mapping.target.kind === "existing").length,
      created: mappings.filter((mapping) => mapping.target.kind === "create").length,
      ignored: mappings.filter((mapping) => mapping.target.kind === "ignore").length,
    }),
    [mappings],
  );

  const targetOptions = useMemo<readonly ListboxOption[]>(
    () => [
      {
        value: IGNORE_VALUE,
        label: "Do not import",
        description: "Leave this column out",
        icon: Ban,
      },
      {
        value: CREATE_VALUE,
        label: "Create new column",
        description: "Add it to the board, named after this header",
        icon: Plus,
      },
      ...columns.map((column) => {
        const refusal = importRefusalFor(column);

        return {
          value: column.id,
          label: column.name,
          description: `${typeLabel(column.type)} — ${typeDescription(column.type)}`,
          icon: columnVisual(column.type).Icon,
          ...(refusal === null ? {} : { isDisabled: true, disabledReason: refusal }),
        };
      }),
    ],
    [columns],
  );

  const typeOptions = useMemo<readonly ListboxOption[]>(
    () =>
      TYPES.map((type) => {
        const refusal = creationRefusalFor(type);

        return {
          value: type,
          label: typeLabel(type),
          description: typeDescription(type),
          icon: columnVisual(type).Icon,
          ...(refusal === null ? {} : { isDisabled: true, disabledReason: refusal }),
        };
      }),
    [],
  );

  const conflictBySource = useMemo(
    () => new Map(conflicts.map((conflict) => [conflict.sourceIndex, conflict.message])),
    [conflicts],
  );

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-ui text-foreground">
          <Checkbox
            checked={hasHeaderRow}
            onChange={(event) => onSetHeaderRow(event.target.checked)}
          />
          First row holds column names
        </label>

        <span className="metric text-body text-faint-foreground">
          {source.fileName}
          {source.sheetName ? ` · ${source.sheetName}` : ""} ·{" "}
          {formatCount(source.rows.length, "row")}
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        <SummaryChip count={counts.existing} label="into existing columns" tone="accent" />
        <SummaryChip count={counts.created} label="new columns" tone="accent" />
        <SummaryChip count={counts.ignored} label="not imported" tone="muted" />
      </ul>

      {wasTruncated && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body text-foreground">
          Only the first {source.rows.length.toLocaleString("en-GB")} rows of this file will be
          imported.
        </p>
      )}

      <ul className="space-y-1.5">
        {source.headers.map((header, sourceIndex) => {
          const target = mappings[sourceIndex]?.target ?? { kind: "ignore" as const };

          return (
            <ImportMappingRow
              key={`${header}_${sourceIndex}`}
              header={header}
              sourceIndex={sourceIndex}
              samples={samplesFor(source.rows, sourceIndex)}
              target={target}
              targetColumn={
                target.kind === "existing" ? columnById.get(target.columnId) ?? null : null
              }
              conflict={conflictBySource.get(sourceIndex)}
              targetOptions={targetOptions}
              typeOptions={typeOptions}
              onSetTarget={onSetTarget}
            />
          );
        })}
      </ul>

      {unmapped.length > 0 && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            isRemovingUnmapped ? "border-danger/40 bg-danger/5" : "border-border bg-surface",
          )}
        >
          <label className="flex cursor-pointer items-start gap-2">
            <Checkbox
              checked={isRemovingUnmapped}
              className="mt-0.5"
              onChange={(event) => onSetRemovingUnmapped(event.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-ui text-foreground">
                Remove the {formatCount(unmapped.length, "column")} this file has no data for
              </span>
              <span className="mt-0.5 flex flex-wrap gap-1">
                {unmapped.map((column) => (
                  <span
                    key={column.id}
                    className="rounded border border-border px-1.5 py-0.5 text-body text-muted-foreground"
                  >
                    {column.name}
                  </span>
                ))}
              </span>
              <span className="mt-1 block text-body text-faint-foreground">
                {isRemovingUnmapped
                  ? "They are removed after the records land, taking their value off every record already on the board."
                  : "They stay on the board, empty for the imported records."}
              </span>
            </span>
          </label>
        </div>
      )}

      <ImportPreviewTable
        source={source}
        rows={preview}
        mappings={mappings}
        columns={columns}
      />

      <ImportPreviewFooter shown={preview.length} total={source.rows.length} />
    </div>
  );
}

interface SummaryChipProps {
  readonly count: number;
  readonly label: string;
  readonly tone: "accent" | "muted";
}

function SummaryChip({ count, label, tone }: SummaryChipProps) {
  return (
    <li
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-body",
        count === 0
          ? "border-border text-faint-foreground"
          : tone === "accent"
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-border bg-hover text-muted-foreground",
      )}
    >
      <span className="metric font-medium">{count}</span> {label}
    </li>
  );
}
