"use client";

import { ListOrdered } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { EditorSurface } from "@/components/board/cells/cell-frame";
import { FlowedText } from "@/components/board/cells/flowed-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import {
  canFormatSteps,
  formatSteps,
  lineAt,
  nextStepInsertion,
  numberPastedLines,
  openingText,
  spacesAfter,
} from "@/lib/step-numbering";
import type { CellDisplayMode, CellValue, StepNumbering } from "@/types";

export function LongTextCellView({
  value,
  mode = "compact",
  width,
  hasReader = false,
}: {
  readonly value: Extract<CellValue, { kind: "longText" }>;
  readonly mode?: CellDisplayMode;
  readonly width: number;
  readonly hasReader?: boolean;
}) {
  return (
    <FlowedText
      text={value.value}
      mode={mode}
      width={width}
      hasReader={hasReader}
      className="text-lead text-muted-foreground"
    />
  );
}

interface LongTextEditorProps {
  readonly value: Extract<CellValue, { kind: "longText" }>;
  readonly rows: number;
  readonly initialText?: string;
  /** Step numbering from the column, when the column has it switched on. */
  readonly steps?: StepNumbering;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

/**
 * Expands over the grid so long notes are editable without leaving the row.
 *
 * With step numbering on, the keys divide like this:
 *
 *   - **Enter** opens the next numbered step. It is the common case in a test
 *     case — one step, then the next — so it gets the unmodified key.
 *   - **Shift+Enter** is a plain newline, for a step that runs to two lines.
 *   - **⌘/Ctrl+Enter** saves, as everywhere else in the app.
 *
 * With numbering off nothing changes: Enter is a newline, as it always was.
 */
export function LongTextCellEditor({
  value,
  rows,
  initialText,
  steps,
  onCommit,
  onCancel,
}: LongTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const isCancelled = useRef(false);

  const isNumbering = steps?.enabled === true;
  const base = initialText ?? value.value;

  // A blank cell opens on its first step, already numbered — see `openingText`.
  const opening = steps ? openingText(value.value, initialText, steps) : base;
  const seed = opening.slice(0, opening.length - base.length);

  const [draft, setDraft] = useState(opening);

  /**
   * What a commit writes. A cell nobody typed into stays empty — the seed is an
   * invitation, not a value, and saving it would turn "no steps" into "step one
   * with nothing in it" every time somebody clicked through a cell.
   */
  const committed = (): string => (seed.length > 0 && draft === seed ? "" : draft);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, []);

  /**
   * Replace the selection with `insertion`, caret after it.
   *
   * The insertion is done *by the textarea*, against its own live value, and
   * React is told afterwards. Building the new string from the `draft` state
   * and restoring the caret on the next frame raced the render: two Enters in
   * quick succession both read the pre-render caret, and the token landed
   * again inside the line it had just opened — one keypress producing several
   * steps at once. The DOM is the only thing that knows where the caret is at
   * the moment of the keystroke, so it is what this asks.
   */
  function insert(insertion: string, absorbSpaces = false) {
    const area = ref.current;
    if (!area) return;

    const end =
      absorbSpaces && area.selectionStart === area.selectionEnd
        ? area.selectionEnd + spacesAfter(area.value, area.selectionEnd)
        : area.selectionEnd;

    area.setRangeText(insertion, area.selectionStart, end, "end");
    setDraft(area.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      isCancelled.current = true;
      onCancel();
      return;
    }

    if (event.key !== "Enter") return;

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      onCommit({ kind: "longText", value: committed() });
      return;
    }

    // Shift+Enter is the plain newline the textarea would give anyway.
    if (event.shiftKey || !isNumbering || !steps) return;

    event.preventDefault();

    // Read the line under the caret off the field, not off the last render.
    const area = event.currentTarget;
    insert(nextStepInsertion(lineAt(area.value, area.selectionStart), steps), true);
  }

  /**
   * A paste of several plainly unnumbered lines becomes numbered steps. A paste
   * that already carries numbers is left exactly as it arrived — see
   * `numberPastedLines`, which refuses rather than guessing.
   */
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!isNumbering || !steps) return;

    const text = event.clipboardData.getData("text/plain");
    const numbered = numberPastedLines(text, steps);
    if (!numbered) return;

    event.preventDefault();
    insert(numbered);
  }

  const canFormat = isNumbering && steps ? canFormatSteps(draft, steps) : false;

  return (
    <EditorSurface className="w-[26rem]">
      {/* Ghost, because the editor surface around it already draws the border
          and the focus ring. The editor is only mounted while a cell is being
          edited, so nothing here is on the grid's render path. */}
      <Textarea
        ref={ref}
        variant="ghost"
        value={draft}
        rows={rows}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (!isCancelled.current) onCommit({ kind: "longText", value: committed() });
        }}
        aria-label="Edit long text"
        className="w-full p-2 text-lead leading-relaxed"
      />

      <div className="flex items-center gap-1.5 border-t border-border px-2 py-1 text-micro text-faint-foreground">
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
        {isNumbering && steps && (
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto gap-1"
            disabled={!canFormat}
            // Renumbering prose would destroy it, so the action is offered only
            // for a block that already reads as steps and would actually change.
            title={
              canFormat
                ? "Renumber these steps in sequence"
                : "These lines are already numbered in sequence, or are not steps"
            }
            // The pointer must not leave the textarea: blurring it commits.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setDraft(formatSteps(draft, steps))}
          >
            <ListOrdered />
            Format steps
          </Button>
        )}
      </div>
    </EditorSurface>
  );
}
