"use client";

import { useId } from "react";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
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
}: DrawerFieldProps) {
  const visual = columnVisual(column.type);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;

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

      <div className="relative min-w-0">
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
            onClick={() => onEditingChange(true)}
            className={cn(
              // The floor is the control ladder's own 32px step rather than a
              // loose min-h-8, so a field at rest is exactly as tall as the
              // editor that replaces it and the row never jumps on open.
              "flex min-h-[var(--control-md)] w-full items-center rounded-md text-left",
              "border border-transparent outline-none transition-colors",
              "hover:border-border hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <CellRenderer value={value} column={column} context={context} />
          </button>
        )}
      </div>
    </div>
  );
}
