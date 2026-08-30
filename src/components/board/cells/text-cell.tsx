"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FlowedText } from "@/components/board/cells/flowed-text";

import { useCellCommit } from "@/hooks/use-cell-commit";
import { isComposingKey } from "@/lib/dom/ime";
import { arrowExitDirection, type CellMove } from "@/lib/cell-arrow-exit";
import type { CellDisplayMode, CellValue } from "@/types";

interface TextViewProps {
  readonly value: Extract<CellValue, { kind: "text" }>;
  readonly isPrimary?: boolean;
  readonly mode?: CellDisplayMode;
  readonly width: number;
  readonly hasReader?: boolean;
}

export function TextCellView({
  value,
  isPrimary = false,
  mode = "compact",
  width,
  hasReader = false,
}: TextViewProps) {
  return (
    <FlowedText
      text={value.value}
      mode={mode}
      width={width}
      hasReader={hasReader}
      className={
        isPrimary ? "text-lead font-medium text-foreground" : "text-lead text-muted-foreground"
      }
    />
  );
}

interface TextEditorProps {
  readonly value: Extract<CellValue, { kind: "text" }>;
  readonly initialText?: string;
  readonly onCommit: (value: CellValue, move?: CellMove) => void;
  readonly onCancel: () => void;
  /** Xem `canExitByArrow` của `CellEditor`. */
  readonly canExitByArrow?: boolean;
}

export function TextCellEditor({
  value,
  initialText,
  onCommit,
  onCancel,
  canExitByArrow = false,
}: TextEditorProps) {
  const [draft, setDraft] = useState(initialText ?? value.value);
  const inputRef = useRef<HTMLInputElement>(null);

  const { finish, discard } = useCellCommit(
    () => onCommit({ kind: "text", value: draft }, "none"),
    inputRef,
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Bộ gõ đang ghép chữ: Enter lúc này là để CHỐT chữ, không phải để lưu ô.
    if (isComposingKey(event.nativeEvent)) return;

    if (event.key === "Enter") {
      event.preventDefault();
      discard();
      onCommit({ kind: "text", value: draft }, "down");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      discard();
      onCancel();
      return;
    }

    const input = event.currentTarget;
    const exit = canExitByArrow
      ? arrowExitDirection({
          key: event.key,
          hasModifier: event.metaKey || event.ctrlKey || event.altKey || event.shiftKey,
          value: input.value,
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd,
          isMultiline: false,
        })
      : null;

    if (exit) {
      event.preventDefault();
      discard();
      onCommit({ kind: "text", value: draft }, exit);
    }
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={finish}
      aria-label="Edit cell"
      className="h-full w-full bg-elevated px-2 text-lead text-foreground outline-none ring-2 ring-accent"
    />
  );
}
