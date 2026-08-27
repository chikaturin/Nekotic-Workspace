"use client";

import { useEffect, useRef, useState } from "react";
import { CellShell, EditorSurface, UnparsedBadge } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/cell-values";
import { formatDate } from "@/lib/format";
import type { BoardColumnOf, CellValue } from "@/types";

type DateValue = Extract<CellValue, { kind: "date" }>;

export function DateCellView({
  value,
  column,
}: {
  value: DateValue;
  column: BoardColumnOf<"date">;
}) {
  return (
    <CellShell>
      {value.iso ? (
        <span className="metric truncate text-ui text-muted-foreground">
          {column.config.includesTime ? formatDateTime(value.iso) : formatDate(value.iso)}
        </span>
      ) : value.text ? (
        <UnparsedBadge text={value.text} />
      ) : null}
    </CellShell>
  );
}

interface DateEditorProps {
  readonly value: DateValue;
  readonly column: BoardColumnOf<"date">;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

/** Uses the platform date picker: keyboard friendly and locale aware for free. */
export function DateCellEditor({ value, column, onCommit, onCancel }: DateEditorProps) {
  const includesTime = column.config.includesTime;
  const [draft, setDraft] = useState(() => toInputValue(value.iso, includesTime));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  function commit(next: string) {
    if (next.length === 0) {
      onCommit({ kind: "date", iso: null });
      return;
    }

    const parsed = new Date(next);
    onCommit(
      Number.isNaN(parsed.getTime())
        ? { kind: "date", iso: null, text: next }
        : { kind: "date", iso: parsed.toISOString() },
    );
  }

  return (
    <EditorSurface className="w-56 p-1.5">
      <input
        ref={inputRef}
        type={includesTime ? "datetime-local" : "date"}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
        aria-label="Edit date"
        className="metric w-full rounded border border-border bg-surface px-2 py-1 text-ui text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <Button size="sm" variant="ghost" onClick={() => commit("")} className="h-6 px-1.5 text-body">
          Clear
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={() => commit(draft)}
          className="h-6 px-2 text-body"
        >
          Save
        </Button>
      </div>
    </EditorSurface>
  );
}

function toInputValue(iso: string | null, includesTime: boolean): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const stamp = date.toISOString();
  return includesTime ? stamp.slice(0, 16) : stamp.slice(0, 10);
}
