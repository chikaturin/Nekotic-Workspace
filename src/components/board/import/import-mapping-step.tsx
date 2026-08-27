"use client";

import { ArrowRight, Ban, CircleAlert, Plus } from "lucide-react";
import { useMemo } from "react";
import { IMPORT_PREVIEW_ROWS } from "@/config/app";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import { columnVisual } from "@/lib/board-visuals";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  /** Board columns this import writes nothing into. */
  readonly unmapped: readonly BoardColumn[];
  readonly isRemovingUnmapped: boolean;
  readonly onSetHeaderRow: (hasHeaderRow: boolean) => void;
  readonly onSetTarget: (sourceIndex: number, target: MappingTarget) => void;
  readonly onSetRemovingUnmapped: (remove: boolean) => void;
}

/**
 * Sentinel values for the two choices that are not a board column. They are
 * strings because the control speaks strings; nothing outside this file ever
 * sees them — `onSetTarget` receives the tagged target instead.
 */
const IGNORE_VALUE = "__ignore__";
const CREATE_VALUE = "__create__";

const TYPES = Object.keys(COLUMN_TYPE_LABELS) as readonly ColumnType[];

/** What a cell with nothing in it looks like, so a blank reads as deliberate. */
const BLANK = "—";

/**
 * Step 2: decide where each column in the file goes.
 *
 * Each source column owns its own decision — ignore it, write it into a column
 * the board already has, or bring it in as a new column with its own name and
 * cell type. Nothing is shared between the rows of this list, so choosing a
 * type for one column cannot land on the next.
 *
 * Claiming a board column another source column already writes is *not*
 * silently taken from the first one. It is reported here and blocks the step,
 * because a mapping that moves on its own is indistinguishable from a mapping
 * that was never made.
 */
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
  const mappedCount = mappings.filter((mapping) => mapping.target.kind === "existing").length;
  const newCount = mappings.filter((mapping) => mapping.target.kind === "create").length;

  /**
   * Every source column offers the same list, so it is built once rather than
   * once per header. The type icon rides on the option itself, which is why the
   * select can show it.
   */
  const targetOptions = useMemo<readonly ListboxOption[]>(
    () => [
      { value: IGNORE_VALUE, label: "Do not import", icon: Ban },
      { value: CREATE_VALUE, label: "Create new column", icon: Plus },
      ...columns.map((column) => ({
        value: column.id,
        label: column.name,
        icon: columnVisual(column.type).Icon,
      })),
    ],
    [columns],
  );

  const typeOptions = useMemo<readonly ListboxOption[]>(
    () =>
      TYPES.map((type) => ({
        value: type,
        label: COLUMN_TYPE_LABELS[type],
        icon: columnVisual(type).Icon,
      })),
    [],
  );

  const conflictBySource = useMemo(
    () => new Map(conflicts.map((conflict) => [conflict.sourceIndex, conflict.message])),
    [conflicts],
  );

  function handleTargetChange(sourceIndex: number, header: string, value: string | null) {
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
          {source.sheetName ? ` · ${source.sheetName}` : ""} · {formatCount(source.rows.length, "row")}{" "}
          · {mappedCount} mapped
          {newCount > 0 && ` · ${formatCount(newCount, "new column")}`}
        </span>
      </div>

      {wasTruncated && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body text-foreground">
          Only the first {source.rows.length.toLocaleString("en-GB")} rows of this file will be
          imported.
        </p>
      )}

      <ul className="space-y-1.5">
        {source.headers.map((header, sourceIndex) => {
          const target = mappings[sourceIndex]?.target ?? { kind: "ignore" };
          const message = conflictBySource.get(sourceIndex);

          return (
            <li
              key={`${header}_${sourceIndex}`}
              className={cn(
                "rounded-md border bg-surface px-2 py-1.5",
                message ? "border-danger/40" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-ui font-medium text-foreground" title={header}>
                  {header}
                </span>

                <ArrowRight className="size-3 shrink-0 text-faint-foreground" aria-hidden />

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
                  className="w-52"
                  onValueChange={(value) => handleTargetChange(sourceIndex, header, value)}
                />

                {/* Only a column being created has a name and a type to
                    choose; each one holds its own, so nothing here is shared
                    with the row above or below it. */}
                {target.kind === "create" && (
                  <>
                    <Input
                      value={target.name}
                      aria-label={`Name for the column created from “${header}”`}
                      placeholder="Column name"
                      className="h-7 w-40 text-ui"
                      onChange={(event) =>
                        onSetTarget(sourceIndex, { ...target, name: event.target.value })
                      }
                    />
                    <Select
                      options={typeOptions}
                      value={target.type}
                      aria-label={`Cell type for the column created from “${header}”`}
                      className="w-36"
                      onValueChange={(value) =>
                        value && onSetTarget(sourceIndex, { ...target, type: value as ColumnType })
                      }
                    />
                  </>
                )}
              </div>

              {message && (
                <p className="mt-1 flex items-center gap-1.5 text-body text-danger">
                  <CircleAlert className="size-3 shrink-0" />
                  {message}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* The board's own leftovers. A board made from a template arrives with
          columns the file knows nothing about, and after an import that defines
          the real schema they sit there empty. Removing them is offered, never
          assumed: the checkbox says what it costs and starts unticked. */}
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

      {/* The preview reads down the file, one line per source row, with the
          row number the sheet itself shows. A blank is drawn as a blank: if
          the alignment were wrong, it would be wrong here, before anything is
          written. */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-24 p-2 text-body font-medium text-faint-foreground">Source row</th>
              {source.headers.map((header, index) => (
                <th key={`${header}_${index}`} className="min-w-32 p-2 align-top">
                  <p className="truncate text-ui font-medium text-foreground" title={header}>
                    {header}
                  </p>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {preview.map((row) => (
              <tr key={row.sourceRowNumber} className="border-b border-hairline last:border-0">
                <td className="metric p-2 text-body text-faint-foreground">
                  {row.sourceRowNumber}
                </td>
                {source.headers.map((_, columnIndex) => {
                  const cell = row.cells[columnIndex] ?? "";

                  return (
                    <td
                      key={columnIndex}
                      className={cn(
                        "max-w-64 truncate p-2 text-body",
                        cell.trim() ? "text-muted-foreground" : "text-faint-foreground",
                      )}
                      title={cell}
                    >
                      {cell.trim() ? cell : BLANK}
                    </td>
                  );
                })}
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
