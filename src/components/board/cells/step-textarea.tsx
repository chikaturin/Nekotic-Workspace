"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import {
  indentSelection,
  lineAt,
  nextStepInsertion,
  numberPastedLines,
  outdentSelection,
  spacesAfter,
} from "@/lib/step-numbering";
import { cn } from "@/lib/utils";
import type { StepNumbering } from "@/types";

interface StepTextareaProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  /** Step numbering from the column, when the column has it switched on. */
  readonly steps?: StepNumbering | undefined;
  readonly rows?: number;
  readonly autoFocus?: boolean;
  /** ⌘/Ctrl+Enter. */
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  readonly onBlur?: (() => void) | undefined;
  readonly label: string;
  readonly className?: string;
}

/**
 * The field a step list is written in.
 *
 * Shared by the editor that opens over the cell and the one that opens over the
 * screen, because they are the same field at two sizes — and a key that means
 * one thing in the small one and another in the big one is worse than either.
 *
 * Every edit is made *by the textarea*, against its own live value, and React
 * is told afterwards. Building the new string from state and restoring the
 * caret on the next frame raced the render: two Enters in quick succession both
 * read the pre-render caret, and the token landed again inside the line it had
 * just opened — one keypress producing several steps at once. The DOM is the
 * only thing that knows where the caret is at the moment of the keystroke.
 */
export function StepTextarea({
  value,
  onChange,
  steps,
  rows,
  autoFocus = false,
  onSubmit,
  onCancel,
  onBlur,
  label,
  className,
}: StepTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const isNumbering = steps?.enabled === true;

  useEffect(() => {
    if (!autoFocus) return;
    const area = ref.current;
    if (!area) return;

    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [autoFocus]);

  /** Replace the selection with `insertion`, caret after it. */
  function insert(insertion: string, absorbSpaces = false) {
    const area = ref.current;
    if (!area) return;

    const end =
      absorbSpaces && area.selectionStart === area.selectionEnd
        ? area.selectionEnd + spacesAfter(area.value, area.selectionEnd)
        : area.selectionEnd;

    area.setRangeText(insertion, area.selectionStart, end, "end");
    onChange(area.value);
  }

  /** Apply a whole-value rewrite — what indent and outdent produce. */
  function rewrite(edit: { text: string; selectionStart: number; selectionEnd: number }) {
    const area = ref.current;
    if (!area) return;
    if (edit.text === area.value) return;

    area.setRangeText(edit.text, 0, area.value.length, "preserve");
    area.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    onChange(area.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const area = event.currentTarget;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    /*
     * Tab indents rather than leaving the field.
     *
     * This is a document, not a form field: a sub-point lines up under the
     * words above it, and the only way to do that was to hold the spacebar.
     * Nothing is lost by trapping the key — a blur here commits and closes the
     * editor, so tabbing out already meant "stop editing", and Escape still
     * says that more clearly. The footer names the key so it is not a secret.
     */
    if (event.key === "Tab") {
      event.preventDefault();
      const edit = event.shiftKey
        ? outdentSelection(area.value, area.selectionStart, area.selectionEnd)
        : indentSelection(area.value, area.selectionStart, area.selectionEnd);
      rewrite(edit);
      return;
    }

    if (event.key !== "Enter") return;

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      onSubmit();
      return;
    }

    // Shift+Enter is the plain newline the textarea would give anyway.
    if (event.shiftKey || !isNumbering || !steps) return;

    event.preventDefault();
    // Read the line under the caret off the field, not off the last render.
    insert(nextStepInsertion(lineAt(area.value, area.selectionStart), steps), true);
  }

  /**
   * A paste of several plainly unnumbered lines becomes numbered steps. A paste
   * that already carries numbers is left exactly as it arrived — see
   * `numberPastedLines`, which refuses rather than guessing.
   */
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!isNumbering || !steps) return;

    const numbered = numberPastedLines(event.clipboardData.getData("text/plain"), steps);
    if (!numbered) return;

    event.preventDefault();
    insert(numbered);
  }

  return (
    <Textarea
      ref={ref}
      variant="ghost"
      value={value}
      {...(rows === undefined ? {} : { rows })}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...(onBlur ? { onBlur } : {})}
      aria-label={label}
      className={cn("w-full p-2 text-lead leading-relaxed", className)}
    />
  );
}

/**
 * What the keys do, said where the keys are used.
 *
 * Tab is on the list because trapping it is the surprising half of this
 * editor: everywhere else in a form it moves on, and a field that quietly
 * keeps it has to say so.
 */
export function StepHints({ isNumbering }: { readonly isNumbering: boolean }) {
  return (
    <>
      <Kbd>⌘</Kbd>
      <Kbd>↵</Kbd>
      to save
      {isNumbering && (
        <>
          <span className="mx-0.5">·</span>
          <Kbd>↵</Kbd>
          next step
          <span className="mx-0.5">·</span>
          <Kbd>⇧</Kbd>
          <Kbd>↵</Kbd>
          new line
        </>
      )}
      <span className="mx-0.5">·</span>
      <Kbd>⇥</Kbd>
      indent
    </>
  );
}
