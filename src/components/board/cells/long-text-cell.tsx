"use client";

import { ListOrdered, Maximize2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { EditorSurface } from "@/components/board/cells/cell-frame";
import { FlowedText } from "@/components/board/cells/flowed-text";
import { StepHints, StepTextarea } from "@/components/board/cells/step-textarea";
import { useCellCommit } from "@/hooks/use-cell-commit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CellExit, CellMove } from "@/lib/cell-arrow-exit";
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
  readonly steps?: StepNumbering;
  readonly label?: string;
  readonly onCommit: (value: CellValue, move?: CellMove) => void;
  readonly onCancel: () => void;
  /** Xem `canExitByArrow` của `CellEditor`. */
  readonly canExitByArrow?: boolean;
}

export function LongTextCellEditor({
  value,
  rows,
  initialText,
  steps,
  label = "Edit long text",
  onCommit,
  onCancel,
  canExitByArrow = false,
}: LongTextEditorProps) {
  const isNumbering = steps?.enabled === true;
  const base = initialText ?? value.value;

  const opening = steps ? openingText(value.value, initialText, steps) : base;
  const seed = opening.slice(0, opening.length - base.length);

  const [draft, setDraft] = useState(opening);
  const [isExpanded, setIsExpanded] = useState(false);

  const committed = (): string => (seed.length > 0 && draft === seed ? "" : draft);

  const surfaceRef = useRef<HTMLDivElement>(null);

  const { finish, discard } = useCellCommit(
    () => onCommit({ kind: "longText", value: committed() }),
    surfaceRef,
  );

  const save = () => {
    discard();
    onCommit({ kind: "longText", value: committed() });
  };

  const leave = (direction: CellExit) => {
    discard();
    onCommit({ kind: "longText", value: committed() }, direction);
  };
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
      <div ref={surfaceRef}>
      <StepTextarea
        value={draft}
        onChange={setDraft}
        steps={steps}
        rows={rows}
        autoFocus
        label={label}
        onSubmit={save}
        onCancel={onCancel}
        onBlur={finish}
        {...(canExitByArrow ? { onExit: leave } : {})}
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
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              // Bàn giao cho editor toàn màn hình: ô inline bị gỡ đi nhưng
              // người dùng CHƯA viết xong, nên không được ghi ở đây.
              discard();
              setIsExpanded(true);
            }}
          >
            <Maximize2 />
          </Button>
        </span>
      </div>
    </div>
    </EditorSurface>
  );
}

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
