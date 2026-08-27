"use client";

import { Maximize2 } from "lucide-react";
import { useId, useState } from "react";
import { CellDetailDialog } from "@/components/board/cells/cell-detail-dialog";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { estimateLines, isFlexibleColumn, WRAP_MAX_LINES } from "@/lib/cell-display";
import { cellText } from "@/lib/cell-values";
import { Label } from "@/components/ui/field";
import { columnVisual } from "@/lib/board-visuals";
import type { CellContext } from "@/lib/cell-values";
import { cn } from "@/lib/utils";
import type { BoardColumn, CellValue, DirectoryUser, SelectOption } from "@/types";

interface DrawerFieldProps {
  readonly column: BoardColumn;
  readonly value: CellValue;
  readonly context: CellContext;
  readonly rowId: string;
  readonly boardId: string;
  readonly primaryColumnId: string;
  readonly folderId: string | null;
  readonly people: readonly DirectoryUser[];
  /** The whole schema — an option rule can test any column of this record. */
  readonly columns: readonly BoardColumn[];
  /**
   * Whether this field is the one being edited. The drawer owns it, so opening
   * a second field closes the first — one editor on screen, one caret, one
   * place a keystroke can land.
   */
  readonly isEditing: boolean;
  readonly onEditingChange: (isEditing: boolean) => void;
  readonly onCommit: (value: CellValue) => void;
  readonly onCreateOption: (label: string) => Promise<SelectOption | null>;
  /** What the record is called, shown in the reader so it names its record. */
  readonly recordLabel?: string;
  /**
   * The record is archived. Its fields are `inert`, so nothing inside them can
   * be clicked or tabbed to — including a reader button. They are shown in
   * full instead, which is what a frozen record wants anyway.
   */
  readonly isFrozen?: boolean;
  /**
   * Whether this record accepts writes at all. The drawer already refuses to
   * commit without it; without it here the field still opened an editor, and
   * an editor whose commits are dropped is worse than no editor.
   */
  readonly canEdit?: boolean;
}

/**
 * A record field in the drawer. It reuses the grid's renderers and editors, so
 * the drawer can never drift from the table: same value, same editor, same
 * write path — which is why an edit here shows up in the row instantly.
 */
export function DrawerField({
  column,
  value,
  context,
  rowId,
  boardId,
  primaryColumnId,
  folderId,
  people,
  columns,
  isEditing,
  onEditingChange,
  onCommit,
  onCreateOption,
  recordLabel,
  isFrozen = false,
  canEdit = true,
}: DrawerFieldProps) {
  const visual = columnVisual(column.type);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;

  const [isReading, setIsReading] = useState(false);

  /**
   * The drawer is where a record is read, so its text fields wrap instead of
   * being clipped to a line — the panel has the width, and a step shown as
   * `B1: Bấm vào đổi số điện…` is the one thing this surface exists to avoid.
   *
   * Past a few lines it still has to stop, which is what the reader is for.
   */
  const isWrapped = isFlexibleColumn(column);

  /**
   * Whether the wrap clamp is actually hiding something.
   *
   * Measured the way the clamp measures — lines the text *takes at this width*,
   * not the newlines in it. An 800-character paragraph with no newlines is one
   * "line" by that reading and sixteen on screen, so counting newlines put the
   * reader button exactly where it was not needed and withheld it exactly where
   * it was.
   */
  const mode: "full" | "wrap" | "compact" = isWrapped ? (isFrozen ? "full" : "wrap") : "compact";
  const hasMore =
    isWrapped &&
    !isFrozen &&
    estimateLines(cellText(value, column, context), DRAWER_FIELD_WIDTH, "full") > WRAP_MAX_LINES;

  return (
    <div
      data-drawer-field={column.id}
      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-3 py-1.5"
    >
      {/*
        The caption carries `Label`'s type step so a field name here and a
        field name in a dialog are the same words at the same size, but it
        deliberately has no `htmlFor`: the thing it names swaps identity — a
        button while the field is at rest, whatever control the CellEditor
        mounts once it is open — so an id to point at exists only half the
        time. `aria-labelledby` on the button reads the same caption without
        turning the caption into a second way to open the editor.
      */}
      <Label id={labelId} className="mb-0 flex min-w-0 items-center gap-1.5 pt-1.5">
        <visual.Icon className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="truncate">{column.name}</span>
      </Label>

      <div className="group/field relative min-w-0">
        {isEditing ? (
          <CellEditor
            value={value}
            column={column}
            rowId={rowId}
            boardId={boardId}
            primaryColumnId={primaryColumnId}
            folderId={folderId}
            people={people}
            columns={columns}
            context={context}
            onCommit={(next) => {
              onCommit(next);
              onEditingChange(false);
            }}
            onCancel={() => onEditingChange(false)}
            onCreateOption={onCreateOption}
          />
        ) : (
          <button
            type="button"
            id={valueId}
            // Caption first, then the button's own contents: "Due date, 14
            // March". Naming it from the caption alone would announce every
            // field without its value, and from the value alone — which is
            // what a bare button does — without saying which field it is.
            aria-labelledby={`${labelId} ${valueId}`}
            disabled={!canEdit}
            onClick={() => onEditingChange(true)}
            className={cn(
              // The floor is the control ladder's own 32px step rather than a
              // loose min-h-8, so a field at rest is exactly as tall as the
              // editor that replaces it and the row never jumps on open.
              "flex min-h-[var(--control-md)] w-full items-center rounded-md text-left",
              "border border-transparent outline-none transition-colors",
              canEdit && "hover:border-border hover:bg-hover",
              "focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <CellRenderer
              value={value}
              column={column}
              context={context}
              mode={mode}
              // The drawer's own column, not the table's: a field laid out at
              // the width of the cell it came from would wrap at 180px inside
              // a 360px panel.
              width={DRAWER_FIELD_WIDTH}
            />
          </button>
        )}

        {/*
          Reading the whole of a long value, without opening an editor for it.
          Only where there is more than one line to read, and never while the
          field is being edited — the editor already shows all of it.
        */}
        {!isEditing && hasMore && (
          <button
            type="button"
            aria-label={`Read all of ${column.name}`}
            title="Read the whole value"
            onClick={() => setIsReading(true)}
            // Faded rather than `hidden`: a display:none button cannot be
            // tabbed to, so `focus-visible` on one is dead CSS and the only
            // way to the reader would be a pointer. Opaque because it sits
            // over the end of a line, and text showing through a button reads
            // worse than the button does.
            className="absolute right-1 top-1 rounded bg-elevated p-1 text-faint-foreground opacity-0 shadow-raise transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/field:opacity-100"
          >
            <Maximize2 className="size-3" />
          </button>
        )}
      </div>

      <CellDetailDialog
        column={isReading ? column : null}
        value={isReading ? value : null}
        context={context}
        {...(recordLabel ? { recordLabel } : {})}
        onClose={() => setIsReading(false)}
        onEdit={
          canEdit
            ? () => {
                setIsReading(false);
                onEditingChange(true);
              }
            : undefined
        }
      />
    </div>
  );
}

/**
 * How wide the drawer's value column is, near enough.
 *
 * Only ever used to decide where text *would* wrap, never to size anything, so
 * a few pixels either way changes nothing that is rendered.
 */
const DRAWER_FIELD_WIDTH = 360;
