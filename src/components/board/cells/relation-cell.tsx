"use client";

import { Link2, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CellOverflowCount,
  CellShell,
  EditorSurface,
  UnparsedBadge,
} from "@/components/board/cells/cell-frame";
import { Input } from "@/components/ui/input";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { splitForCell } from "@/lib/cell-overflow";
import { DELETED_LABEL } from "@/lib/cell-values";
import { cn } from "@/lib/utils";
import { boardService } from "@/services/board-service";
import type { BoardColumn, BoardColumnOf, BoardRow, CellValue } from "@/types";

type RelationValue = Extract<CellValue, { kind: "relation" }>;

function relationLabel(
  rowId: string,
  labels: ReadonlyMap<string, string>,
  isResolved: boolean,
): string {
  const label = labels.get(rowId);
  if (label !== undefined) return label;
  return isResolved ? DELETED_LABEL : rowId;
}

export function RelationCellView({
  value,
  labels,
  isResolved = false,
}: {
  value: RelationValue;
  labels: ReadonlyMap<string, string>;
  isResolved?: boolean;
}) {
  const { shown, overflow } = splitForCell(value.rowIds);

  return (
    <CellShell>
      {value.rowIds.length > 0 ? (
        <>
          {shown.map((rowId) => {
            const isDeleted = labels.get(rowId) === undefined && isResolved;

            return (
              <span
                key={rowId}
                title={relationLabel(rowId, labels, isResolved)}
                className={cn(
                  "metric inline-flex min-w-0 shrink items-center gap-1 rounded border px-1.5 py-0.5 text-micro",
                  isDeleted
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                <Link2 className="size-2.5 shrink-0" />
                <span className="truncate">{relationLabel(rowId, labels, isResolved)}</span>
              </span>
            );
          })}

          {overflow > 0 && (
            <CellOverflowCount
              count={overflow}
              title={value.rowIds
                .map((rowId) => relationLabel(rowId, labels, isResolved))
                .join(", ")}
            />
          )}
        </>
      ) : value.text ? (
        <UnparsedBadge text={value.text} />
      ) : null}
    </CellShell>
  );
}

interface RelationEditorProps {
  readonly value: RelationValue;
  readonly column: BoardColumnOf<"relation">;
  readonly targetBoardId: string;
  readonly boardId: string;
  readonly primaryColumnId: string;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

const NO_COLUMNS: readonly BoardColumn[] = [];

export function RelationCellEditor({
  value,
  column,
  targetBoardId,
  boardId,
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

  const isCrossBoard = targetBoardId !== boardId;
  const needsLookup = isCrossBoard && column.config.displayColumnId === null;

  const schemaLoader = useCallback(
    (signal: AbortSignal) =>
      needsLookup
        ? boardService.listColumns(targetBoardId, signal)
        : Promise.resolve(NO_COLUMNS),
    [needsLookup, targetBoardId],
  );

  const { state: schema } = useAsyncResource<readonly BoardColumn[]>(schemaLoader, {
    keepPreviousData: true,
  });

  const titleColumnId =
    schema.status === "success"
      ? (schema.data.find((candidate) => candidate.isPrimary)?.id ?? primaryColumnId)
      : primaryColumnId;

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
          className="h-7 text-ui"
        />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-border p-1.5">
          {selected.map((rowId) => (
            <span
              key={rowId}
              className="metric inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-micro"
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
          <p className="flex items-center gap-1.5 px-1.5 py-2 text-body text-faint-foreground">
            <Loader2 className="size-3 animate-spin" />
            Searching…
          </p>
        )}

        {error && <p className="px-1.5 py-2 text-body text-danger">{error}</p>}

        {!isLoading &&
          !error &&
          results.map((row) => {
            const title = row.cells[titleColumnId];

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => toggle(row.id)}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
              >
                <span className="metric shrink-0 text-micro text-faint-foreground">
                  {row.displayId}
                </span>
                <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                  {title && title.kind === "text" ? title.value : "Untitled"}
                </span>
                {chosen.has(row.id) && <span className="text-micro text-accent">linked</span>}
              </button>
            );
          })}

        {!isLoading && !error && results.length === 0 && (
          <p className="px-1.5 py-2 text-body text-faint-foreground">No records match.</p>
        )}
      </div>

      {column.config.isMulti && (
        <div className="flex justify-end border-t border-border p-1.5">
          <button
            type="button"
            onClick={() => onCommit({ kind: "relation", rowIds: selected })}
            className="rounded bg-accent px-2 py-1 text-body font-medium text-accent-foreground"
          >
            Apply
          </button>
        </div>
      )}
    </EditorSurface>
  );
}
