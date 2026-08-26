"use client";

import { ArrowRight, Ban } from "lucide-react";
import { IMPORT_PREVIEW_ROWS } from "@/config/app";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select-field";
import { columnVisual } from "@/lib/board-visuals";
import { formatCount } from "@/lib/format";
import type { BoardColumn, ColumnMapping, ImportSource } from "@/types";

interface ImportMappingStepProps {
  readonly source: ImportSource;
  readonly columns: readonly BoardColumn[];
  readonly mappings: readonly ColumnMapping[];
  readonly hasHeaderRow: boolean;
  readonly wasTruncated: boolean;
  readonly onSetHeaderRow: (hasHeaderRow: boolean) => void;
  readonly onSetMapping: (sourceIndex: number, columnId: string | null) => void;
}

/**
 * Step 2: point each column in the file at a column on the board.
 *
 * The guess is made from the names and shown as a normal selection, so it can
 * be corrected. Sample values sit under every source column — the fastest way
 * to notice that "Due" actually holds a person's name.
 */
export function ImportMappingStep({
  source,
  columns,
  mappings,
  hasHeaderRow,
  wasTruncated,
  onSetHeaderRow,
  onSetMapping,
}: ImportMappingStepProps) {
  const mappedCount = mappings.filter((mapping) => mapping.columnId !== null).length;
  const preview = source.rows.slice(0, IMPORT_PREVIEW_ROWS);

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
          <Checkbox
            checked={hasHeaderRow}
            onChange={(event) => onSetHeaderRow(event.target.checked)}
          />
          First row holds column names
        </label>

        <span className="metric text-[11px] text-faint-foreground">
          {source.fileName}
          {source.sheetName ? ` · ${source.sheetName}` : ""} ·{" "}
          {formatCount(source.rows.length, "row")} · {mappedCount} of {source.headers.length} columns
          mapped
        </span>
      </div>

      {wasTruncated && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
          Only the first {source.rows.length.toLocaleString("en-GB")} rows of this file will be
          imported.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface">
              {source.headers.map((header, index) => {
                const mapping = mappings[index];
                const target = columns.find((column) => column.id === mapping?.columnId) ?? null;
                const Icon = target ? columnVisual(target.type).Icon : Ban;

                return (
                  <th key={`${header}_${index}`} className="min-w-52 p-2 align-top">
                    <p className="truncate text-[12px] font-medium text-foreground" title={header}>
                      {header}
                    </p>

                    <span className="mt-1 flex items-center gap-1.5">
                      <ArrowRight className="size-3 shrink-0 text-faint-foreground" />
                      <Icon
                        className={`size-3.5 shrink-0 ${target ? "text-accent" : "text-faint-foreground"}`}
                      />
                      <SelectField
                        value={mapping?.columnId ?? ""}
                        aria-label={`Board column for ${header}`}
                        onChange={(event) =>
                          onSetMapping(index, event.target.value === "" ? null : event.target.value)
                        }
                        className="w-full"
                      >
                        <option value="">Do not import</option>
                        {columns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.name}
                          </option>
                        ))}
                      </SelectField>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {preview.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-hairline last:border-0">
                {source.headers.map((_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="max-w-64 truncate p-2 text-[11px] text-muted-foreground"
                    title={row[columnIndex] ?? ""}
                  >
                    {row[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {source.rows.length > preview.length && (
        <p className="metric text-[11px] text-faint-foreground">
          Showing the first {preview.length} rows.{" "}
          <Badge variant="default">{source.rows.length - preview.length} more</Badge>
        </p>
      )}
    </div>
  );
}
