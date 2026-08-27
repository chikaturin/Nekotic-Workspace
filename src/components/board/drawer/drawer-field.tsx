"use client";

import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
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

  return (
    <div
      data-drawer-field={column.id}
      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-3 py-1.5"
    >
      <div className="flex items-center gap-1.5 pt-1.5">
        <visual.Icon className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="truncate text-ui text-muted-foreground">{column.name}</span>
      </div>

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
            onClick={() => onEditingChange(true)}
            className={cn(
              "flex min-h-8 w-full items-center rounded-md border border-transparent text-left",
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
