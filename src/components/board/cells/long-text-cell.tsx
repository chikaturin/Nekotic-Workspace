"use client";

import { ListOrdered, Maximize2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { EditorSurface } from "@/components/board/cells/cell-frame";
import { FlowedText } from "@/components/board/cells/flowed-text";
import { StepHints, StepTextarea } from "@/components/board/cells/step-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canFormatSteps, formatSteps, openingText } from "@/lib/step-numbering";
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
  /** The column's name — what the expanded editor is titled with. */
  readonly label?: string;
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
 *   - **Tab** indents, and Shift+Tab takes it back. See `StepTextarea`.
 *
 * With numbering off nothing changes: Enter is a newline, as it always was.
 *
 * The draft lives here rather than in the field, so opening the full-screen
 * editor is a change of size and nothing else — the same text, the same keys,
 * mid-sentence and uncommitted.
 */
export function LongTextCellEditor({
  value,
  rows,
  initialText,
  steps,
  label = "Edit long text",
  onCommit,
  onCancel,
}: LongTextEditorProps) {
  const isNumbering = steps?.enabled === true;
  const base = initialText ?? value.value;

  // A blank cell opens on its first step, already numbered — see `openingText`.
  const opening = steps ? openingText(value.value, initialText, steps) : base;
  const seed = opening.slice(0, opening.length - base.length);

  const [draft, setDraft] = useState(opening);
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * True while the blur is somebody opening the big editor.
   *
   * The inline field commits when it loses focus, and moving focus into a
   * dialog is losing focus — so without this, pressing Expand saved the cell
   * and closed the editor, and the dialog opened over a cell that was no
   * longer being edited.
   */
  const isHandingOver = useRef(false);

  /**
   * What a commit writes. A cell nobody typed into stays empty — the seed is an
   * invitation, not a value, and saving it would turn "no steps" into "step one
   * with nothing in it" every time somebody clicked through a cell.
   */
  const committed = (): string => (seed.length > 0 && draft === seed ? "" : draft);

  const save = () => onCommit({ kind: "longText", value: committed() });
  const canFormat = isNumbering && steps ? canFormatSteps(draft, steps) : false;

  const format = (
    <FormatStepsButton
      isOffered={isNumbering && steps !== undefined}
      canFormat={canFormat}
      onFormat={() => steps && setDraft(formatSteps(draft, steps))}
    />
  );

  if (isExpanded) {
    return (
      <LongTextExpandedEditor
        draft={draft}
        onDraftChange={setDraft}
        steps={steps}
        label={label}
        isNumbering={isNumbering}
        format={format}
        onSave={save}
        onCancel={onCancel}
      />
    );
  }

  return (
    <EditorSurface className="w-[26rem]">
      <StepTextarea
        value={draft}
        onChange={setDraft}
        steps={steps}
        rows={rows}
        autoFocus
        label={label}
        onSubmit={save}
        onCancel={onCancel}
        onBlur={() => {
          if (!isHandingOver.current) save();
        }}
      />

      <div className="flex items-center gap-1.5 border-t border-border px-2 py-1 text-micro text-faint-foreground">
        <StepHints isNumbering={isNumbering} />

        <span className="ml-auto flex items-center gap-1">
          {format}
          <Button
            size="xs"
            variant="ghost"
            aria-label="Open the full editor"
            title="Write this in a full-size editor"
            // The pointer must not commit on its way to the button: a blur
            // here saves, and saving closes the editor the dialog opens from.
            onMouseDown={(event) => event.preventDefault()}
            // The flag is set on the click, not on the press. Arming it on
            // mousedown meant a press that slid off the button and never
            // became a click left the field unable to commit at all — the
            // next click anywhere would have thrown the edit away in silence.
            onClick={() => {
              isHandingOver.current = true;
              setIsExpanded(true);
            }}
          >
            <Maximize2 />
          </Button>
        </span>
      </div>
    </EditorSurface>
  );
}

/**
 * Renumbering prose would destroy it, so the action is offered only for a block
 * that already reads as steps and would actually change.
 */
function FormatStepsButton({
  isOffered,
  canFormat,
  onFormat,
}: {
  readonly isOffered: boolean;
  readonly canFormat: boolean;
  readonly onFormat: () => void;
}) {
  if (!isOffered) return null;

  return (
    <Button
      size="xs"
      variant="ghost"
      className="gap-1"
      disabled={!canFormat}
      title={
        canFormat
          ? "Renumber these steps in sequence"
          : "These lines are already numbered in sequence, or are not steps"
      }
      // The pointer must not leave the textarea: blurring it commits.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onFormat}
    >
      <ListOrdered />
      Format steps
    </Button>
  );
}

interface ExpandedEditorProps {
  readonly draft: string;
  readonly onDraftChange: (next: string) => void;
  readonly steps?: StepNumbering | undefined;
  readonly label: string;
  readonly isNumbering: boolean;
  readonly format: ReactNode;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

/**
 * The same editor, given the screen.
 *
 * A test case is a dozen numbered steps with wrapped sub-points hanging under
 * them, and the panel over the cell shows four lines of it — you write the
 * thing through a letterbox and scroll to check what you already said. This is
 * the same field at a size you can see the whole procedure in.
 *
 * Deliberately not committing on blur, unlike the inline field: a dialog has
 * its own buttons, and a click on Format steps or a drag of the scrollbar is
 * not a decision to stop editing.
 */
function LongTextExpandedEditor({
  draft,
  onDraftChange,
  steps,
  label,
  isNumbering,
  format,
  onSave,
  onCancel,
}: ExpandedEditorProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        size="2xl"
        className="flex max-h-[85dvh] flex-col"
        // Radix would otherwise put focus on the close button. The field is
        // the only thing anybody opened this for, and `StepTextarea` puts the
        // caret at the end of what is already written.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="truncate">{label}</DialogTitle>
          <DialogDescription>
            {isNumbering
              ? "Enter opens the next step, Shift+Enter adds a line, Tab indents."
              : "Tab indents; Shift+Tab takes it back."}
          </DialogDescription>
        </DialogHeader>

        {/* The field is the dialog's body rather than sitting inside one: it
            has to take the height the card gives it, and a scrolling body
            wrapped around a scrolling textarea is two scrollbars for one
            piece of text. */}
        <div className="min-h-0 flex-1 px-5 pb-2">
          <StepTextarea
            value={draft}
            onChange={onDraftChange}
            steps={steps}
            autoFocus
            label={label}
            onSubmit={onSave}
            onCancel={onCancel}
            className="h-full min-h-[24rem] overflow-auto rounded-lg border border-border bg-surface p-3"
          />
        </div>

        <DialogFooter align="start">
          <span className="flex items-center gap-1.5 text-micro text-faint-foreground">
            <StepHints isNumbering={isNumbering} />
          </span>

          <span className="ml-auto flex items-center gap-2">
            {format}
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" variant="default" onClick={onSave}>
              Save
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
