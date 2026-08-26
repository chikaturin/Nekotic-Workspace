"use client";

import { Link2, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CellShell, EditorSurface, UnparsedBadge } from "@/components/board/cells/cell-frame";
import { Input } from "@/components/ui/input";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { DELETED_LABEL } from "@/lib/cell-values";
import { cn } from "@/lib/utils";
import { boardService } from "@/services/board-service";
import type { BoardColumnOf, BoardRow, CellValue } from "@/types";

type RelationValue = Extract<CellValue, { kind: "relation" }>;

/**
 * Relation is wired end to end for one board today and shaped for the module
 * that lands later: the column names a target board, the value stores row ids,
 * and lookup goes through `boardService.searchRows`, which a real API replaces
 * one-for-one. Bidirectional mirroring and referential cleanup are the parts
 * still owned by the backend — see the API report.
 */
export function RelationCellView({
  value,
  labels,
  isResolved = false,
}: {
  value: RelationValue;
  labels: ReadonlyMap<string, string>;
  /** Until every target board has answered, an unknown id is not a deletion. */
  isResolved?: boolean;
}) {
  return (
    <CellShell>
      {value.rowIds.length > 0 ? (
        value.rowIds.map((rowId) => {
          const label = labels.get(rowId);
          const isDeleted = label === undefined && isResolved;

          return (
            <span
              key={rowId}
              className={cn(
                "metric inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                isDeleted
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              <Link2 className="size-2.5" />
              {isDeleted ? DELETED_LABEL : label ?? rowId}
            </span>
          );
        })
      ) : value.text ? (
        <UnparsedBadge text={value.text} />
      ) : null}
    </CellShell>
  );
}

interface RelationEditorProps {
  readonly value: RelationValue;
  readonly column: BoardColumnOf<"relation">;
  /** Board the relation points at; falls back to the current board. */
  readonly targetBoardId: string;
  readonly primaryColumnId: string;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

export function RelationCellEditor({
  value,
  column,
  targetBoardId,
  primaryColumnId,
  onCommit,
  onCancel,
}: RelationEditorProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>(value.rowIds);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const loader = useCallback(
    (signal: AbortSignal) => boardService.searchRows(targetBoardId, query, 20, signal),
    [targetBoardId, query],
  );

  const { state } = useAsyncResource<readonly BoardRow[]>(loader, { keepPreviousData: true });
  const results = state.status === "success" ? state.data : [];
  const isLoading = state.status === "loading" || state.status === "idle";
  const error = state.status === "error" ? state.error.message : null;

  const chosen = useMemo(() => new Set(selected), [selected]);

  function toggle(rowId: string) {
    if (!column.config.isMulti) {
      onCommit({ kind: "relation", rowIds: [rowId] });
      return;
    }

    setSelected((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
    );
  }

  return (
    <EditorSurface className="w-72">
      <div className="border-b border-border p-1.5">
        <Input
          ref={inputRef}
          value={query}
          placeholder="Search records…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
          className="h-7 text-[12px]"
        />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-border p-1.5">
          {selected.map((rowId) => (
            <span
              key={rowId}
              className="metric inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px]"
            >
              {results.find((row) => row.id === rowId)?.displayId ?? rowId}
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => setSelected((current) => current.filter((id) => id !== rowId))}
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="max-h-52 overflow-y-auto p-1">
        {isLoading && (
          <p className="flex items-center gap-1.5 px-1.5 py-2 text-[11px] text-faint-foreground">
            <Loader2 className="size-3 animate-spin" />
            Searching…
          </p>
        )}

        {error && <p className="px-1.5 py-2 text-[11px] text-danger">{error}</p>}

        {!isLoading &&
          !error &&
          results.map((row) => {
            const title = row.cells[primaryColumnId];

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => toggle(row.id)}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
              >
                <span className="metric shrink-0 text-[10px] text-faint-foreground">
                  {row.displayId}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                  {title && title.kind === "text" ? title.value : "Untitled"}
                </span>
                {chosen.has(row.id) && <span className="text-[10px] text-accent">linked</span>}
              </button>
            );
          })}

        {!isLoading && !error && results.length === 0 && (
          <p className="px-1.5 py-2 text-[11px] text-faint-foreground">No records match.</p>
        )}
      </div>

      {column.config.isMulti && (
        <div className="flex justify-end border-t border-border p-1.5">
          <button
            type="button"
            onClick={() => onCommit({ kind: "relation", rowIds: selected })}
            className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground"
          >
            Apply
          </button>
        </div>
      )}
    </EditorSurface>
  );
}
