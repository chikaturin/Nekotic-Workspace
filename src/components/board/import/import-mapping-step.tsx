"use client";

import { ArrowRight, Ban } from "lucide-react";
import { useMemo } from "react";
import { IMPORT_PREVIEW_ROWS } from "@/config/app";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
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
 * The value standing in for "no board column". It mirrors the empty
 * `<option value="">` this select grew out of, and it is unmapped again on the
 * way out, so `onSetMapping` still receives `null` and the wizard never learns
 * that the control changed.
 */
const NO_IMPORT_VALUE = "";

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

  /**
   * Every source column offers the same list, so it is built once rather than
   * once per header — a wide file has dozens of these selects side by side.
   * The type icon rides on the option itself, which is why the select can show
   * it: a native `<option>` has nowhere to put one, so the icon used to sit
   * outside the control and describe a choice it was not part of.
   */
  const columnOptions = useMemo<readonly ListboxOption[]>(
    () => [
      { value: NO_IMPORT_VALUE, label: "Do not import", icon: Ban },
      ...columns.map((column) => ({
        value: column.id,
        label: column.name,
        icon: columnVisual(column.type).Icon,
      })),
    ],
    [columns],
  );

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
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
          {formatCount(source.rows.length, "row")} · {mappedCount} of {source.headers.length} columns
          mapped
        </span>
      </div>

      {wasTruncated && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body text-foreground">
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

                return (
                  <th key={`${header}_${index}`} className="min-w-52 p-2 align-top">
                    <p className="truncate text-ui font-medium text-foreground" title={header}>
                      {header}
                    </p>

                    {/* A div rather than the span this used to be: the select
                        is a composed widget, and phrasing content cannot hold
                        one. */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <ArrowRight className="size-3 shrink-0 text-faint-foreground" />
                      <Select
                        options={columnOptions}
                        value={mapping?.columnId ?? NO_IMPORT_VALUE}
                        aria-label={`Board column for ${header}`}
                        // The native select this replaces had the platform's
                        // type-to-jump, and a board with thirty columns is
                        // where that mattered most. The search field is what
                        // gives it back; nothing here provides it otherwise.
                        isSearchable
                        onValueChange={(value) =>
                          onSetMapping(
                            index,
                            value === null || value === NO_IMPORT_VALUE ? null : value,
                          )
                        }
                      />
                    </div>
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
                    className="max-w-64 truncate p-2 text-body text-muted-foreground"
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
        <p className="metric text-body text-faint-foreground">
          Showing the first {preview.length} rows.{" "}
          <Badge variant="default">{source.rows.length - preview.length} more</Badge>
        </p>
      )}
    </div>
  );
}
