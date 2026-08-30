"use client";

import { Badge } from "@/components/ui/badge";
import { columnVisual } from "@/lib/board-visuals";
import { cn } from "@/lib/utils";
import type { BoardColumn, ColumnMapping, ImportSource } from "@/types";

const BLANK = "—";

interface ImportPreviewTableProps {
  readonly source: ImportSource;
  readonly rows: readonly ImportSource["rows"][number][];
  readonly mappings: readonly ColumnMapping[];
  readonly columns: readonly BoardColumn[];
}

export function ImportPreviewTable({
  source,
  rows,
  mappings,
  columns,
}: ImportPreviewTableProps) {
  const columnById = new Map(columns.map((column) => [column.id, column]));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="w-20 p-2 text-body font-medium text-faint-foreground">Row</th>
            {source.headers.map((header, index) => {
              const target = mappings[index]?.target ?? { kind: "ignore" as const };
              const column =
                target.kind === "existing" ? columnById.get(target.columnId) ?? null : null;
              const Icon =
                target.kind === "create"
                  ? columnVisual(target.type).Icon
                  : column
                    ? columnVisual(column.type).Icon
                    : null;

              return (
                <th
                  key={`${header}_${index}`}
                  className={cn("min-w-32 p-2 align-top", target.kind === "ignore" && "is-disabled")}
                >
                  <p className="truncate text-ui font-medium text-foreground" title={header}>
                    {header}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-body text-faint-foreground">
                    {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
                    {target.kind === "ignore"
                      ? "Not imported"
                      : target.kind === "create"
                        ? `→ ${target.name.trim() || "new column"}`
                        : `→ ${column?.name ?? "board column"}`}
                  </p>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.sourceRowNumber} className="border-b border-hairline last:border-0">
              <td className="metric p-2 text-body text-faint-foreground">{row.sourceRowNumber}</td>
              {source.headers.map((_, columnIndex) => {
                const cell = row.cells[columnIndex] ?? "";
                const isIgnored =
                  (mappings[columnIndex]?.target ?? { kind: "ignore" }).kind === "ignore";

                return (
                  <td
                    key={columnIndex}
                    className={cn(
                      "max-w-64 truncate p-2 text-body",
                      isIgnored
                        ? "text-faint-foreground is-disabled"
                        : cell.trim()
                          ? "text-muted-foreground"
                          : "text-faint-foreground",
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
  );
}

interface PreviewFooterProps {
  readonly shown: number;
  readonly total: number;
}

export function ImportPreviewFooter({ shown, total }: PreviewFooterProps) {
  if (total <= shown) return null;

  return (
    <p className="metric text-body text-faint-foreground">
      Showing the first {shown} rows. <Badge variant="default">{total - shown} more</Badge>
    </p>
  );
}
