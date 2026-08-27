"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CellShell, EditorSurface } from "@/components/board/cells/cell-frame";
import { Kbd } from "@/components/ui/kbd";
import type { CellValue } from "@/types";

export function LongTextCellView({ value }: { value: Extract<CellValue, { kind: "longText" }> }) {
  return (
    <CellShell>
      <span className="min-w-0 truncate text-lead text-muted-foreground">{value.value}</span>
    </CellShell>
  );
}

interface LongTextEditorProps {
  readonly value: Extract<CellValue, { kind: "longText" }>;
  readonly rows: number;
  readonly initialText?: string;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

/** Expands over the grid so long notes are editable without leaving the row. */
export function LongTextCellEditor({
  value,
  rows,
  initialText,
  onCommit,
  onCancel,
}: LongTextEditorProps) {
  const [draft, setDraft] = useState(initialText ?? value.value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const isCancelled = useRef(false);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      isCancelled.current = true;
      onCancel();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onCommit({ kind: "longText", value: draft });
    }
  }

  return (
    <EditorSurface className="w-[22rem]">
      <textarea
        ref={ref}
        value={draft}
        rows={rows}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!isCancelled.current) onCommit({ kind: "longText", value: draft });
        }}
        aria-label="Edit long text"
        className="w-full resize-none bg-transparent p-2 text-lead leading-relaxed text-foreground outline-none"
      />
      <div className="flex items-center gap-1.5 border-t border-border px-2 py-1 text-micro text-faint-foreground">
        <Kbd>⌘</Kbd>
        <Kbd>↵</Kbd>
        to save
      </div>
    </EditorSurface>
  );
}
