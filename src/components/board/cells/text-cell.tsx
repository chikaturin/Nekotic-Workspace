"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FlowedText } from "@/components/board/cells/flowed-text";
import type { CellDisplayMode, CellValue } from "@/types";

interface TextViewProps {
  readonly value: Extract<CellValue, { kind: "text" }>;
  readonly isPrimary?: boolean;
  readonly mode?: CellDisplayMode;
  readonly isInteractive?: boolean;
  readonly width: number;
}

export function TextCellView({
  value,
  isPrimary = false,
  mode = "compact",
  isInteractive = true,
  width,
}: TextViewProps) {
  return (
    <FlowedText
      text={value.value}
      mode={mode}
      width={width}
      isInteractive={isInteractive}
      className={
        isPrimary ? "text-lead font-medium text-foreground" : "text-lead text-muted-foreground"
      }
    />
  );
}

interface TextEditorProps {
  readonly value: Extract<CellValue, { kind: "text" }>;
  readonly initialText?: string;
  readonly onCommit: (value: CellValue, move?: "down" | "none") => void;
  readonly onCancel: () => void;
}

export function TextCellEditor({ value, initialText, onCommit, onCancel }: TextEditorProps) {
  const [draft, setDraft] = useState(initialText ?? value.value);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCancelled = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    // Typing to open the cell keeps the caret after the character typed.
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit({ kind: "text", value: draft }, "down");
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      isCancelled.current = true;
      onCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (!isCancelled.current) onCommit({ kind: "text", value: draft }, "none");
      }}
      aria-label="Edit cell"
      className="h-full w-full bg-elevated px-2 text-lead text-foreground outline-none ring-2 ring-accent"
    />
  );
}
