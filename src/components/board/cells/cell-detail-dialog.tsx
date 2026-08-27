"use client";

import { Pencil } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { columnVisual } from "@/lib/board-visuals";
import { cellText, type CellContext } from "@/lib/cell-values";
import type { BoardColumn, CellValue } from "@/types";

interface CellDetailDialogProps {
  /** The column being read, or null when nothing is open. */
  readonly column: BoardColumn | null;
  readonly value: CellValue | null;
  readonly context: CellContext;
  /** What the record is called, so the reader knows whose value this is. */
  readonly recordLabel?: string;
  readonly onClose: () => void;
  /** Offered only where this reader has an editor to hand over to. */
  readonly onEdit?: (() => void) | undefined;
}

/**
 * One cell, read in full.
 *
 * A QA step is four lines of instructions, and the two ways a table had to
 * show that were a clipped line and the browser's own hover tooltip. Neither
 * is a way to read four lines: the tooltip appears where the pointer happens
 * to be, sets its own width, cannot be scrolled, cannot be selected from, and
 * vanishes the moment you move towards it.
 *
 * This is the alternative, and it is deliberately a *reader* rather than a
 * second editor: a centred card, the value laid out in full with its line
 * breaks intact, and one button that hands over to the real editor for anyone
 * who may write. Being read-only is what lets it open for everybody, including
 * on a board somebody only has permission to look at.
 *
 * Width is `xl` rather than the default: the point of the card is to show a
 * paragraph as a paragraph, and 32rem breaks a numbered step across two lines
 * about as often as the cell did.
 */
export function CellDetailDialog({
  column,
  value,
  context,
  recordLabel,
  onClose,
  onEdit,
}: CellDetailDialogProps) {
  /**
   * True while this close is a hand-over to an editor.
   *
   * Radix returns focus to whatever opened the dialog once it unmounts, and
   * that is the cell the editor has just mounted inside. The restore would
   * blur the editor, and a blurred cell editor commits and closes — so Edit
   * appeared to do nothing at all. Handing over means declining the restore.
   */
  const isHandingOver = useRef(false);

  if (!column || !value) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const visual = columnVisual(column.type);
  const text = cellText(value, column, context);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="xl"
        className="flex max-h-[80dvh] flex-col"
        onCloseAutoFocus={(event) => {
          if (!isHandingOver.current) return;
          isHandingOver.current = false;
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <visual.Icon className="size-4 shrink-0 text-faint-foreground" />
            <span className="min-w-0 truncate">{column.name}</span>
          </DialogTitle>
          {recordLabel && (
            <DialogDescription className="truncate">{recordLabel}</DialogDescription>
          )}
        </DialogHeader>

        {/*
          The value as text, laid out by this card rather than by the column it
          came from — line breaks kept, long words broken, and selectable so it
          can be copied out.

          Deliberately not `CellRenderer`: a cell view is built to fill a row of
          fixed height and clips to it (`h-full overflow-hidden`), which inside
          a scrolling dialog body would hide the end of a long value instead of
          letting the body scroll to it. The one job here is the opposite of a
          cell's.
        */}
        {/*
          Focusable, because it scrolls. Every other stop in this card is in
          the header or the footer, so without it a value taller than the
          viewport could be scrolled with a wheel and by no other means — the
          keyboard would tab Close, Edit, ✕ and never reach the text.
        */}
        <DialogBody
          tabIndex={0}
          role="region"
          aria-label={`${column.name} in full`}
          className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {text.trim().length > 0 ? (
            <p className="whitespace-pre-wrap break-words text-lead leading-relaxed text-foreground">
              {text}
            </p>
          ) : (
            <p className="text-ui text-faint-foreground">This field is empty.</p>
          )}
        </DialogBody>

        <DialogFooter align="start">
          <span className="metric text-body text-faint-foreground">
            {countLines(text)} · {text.length.toLocaleString("en-GB")} characters
          </span>

          <span className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  isHandingOver.current = true;
                  onEdit();
                }}
              >
                <Pencil />
                Edit
              </Button>
            )}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "4 lines", or nothing worth saying for a value that is one. */
function countLines(text: string): string {
  const lines = text.split("\n").length;
  return lines === 1 ? "1 line" : `${lines} lines`;
}
