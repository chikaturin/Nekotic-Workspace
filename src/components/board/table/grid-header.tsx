"use client";

import { Plus } from "lucide-react";
import { memo, useState, type DragEvent, type PointerEvent } from "react";
import { ColumnMenu } from "@/components/board/table/column-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { GUTTER_WIDTH, widthStyle } from "@/components/board/table/grid-shared";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clampColumnWidth, COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import { columnVisual } from "@/lib/board-visuals";
import { useBoardStore } from "@/store/board-store";
import { selectIsRenaming, useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";
import type { BoardColumn, CellDisplayMode, ColumnType, PermissionResolver } from "@/types";

const COLUMN_MIME = "application/x-nexdrop-column";

/** How much of the current view is ticked — what the header box shows. */
export type SelectionState = "none" | "some" | "all";

interface GridHeaderProps {
  readonly columns: readonly BoardColumn[];
  readonly selectionState: SelectionState;
  readonly onToggleAll: () => void;
  /** Bound permission resolver — the header gates each column action on its own key. */
  readonly can: PermissionResolver;
  readonly onConvert: (column: BoardColumn, type: ColumnType) => void;
  readonly onResizePreview: (columnId: string, width: number) => void;
  readonly onResizeCommit: (columnId: string, width: number) => void;
  /** Per-view display mode, and the action that changes it. */
  readonly displayModes: Readonly<Record<string, CellDisplayMode>>;
  readonly onSetDisplayMode: (columnId: string, mode: CellDisplayMode) => void;
  readonly onAutoFitWidth: (columnId: string) => void;
}

/**
 * Sticky header: rename in place, drag to reorder, drag the edge to resize.
 * Resizing writes a CSS variable straight to the DOM while the pointer is
 * down, so a drag never re-renders a single row.
 */
export const GridHeader = memo(function GridHeader({
  columns,
  selectionState,
  onToggleAll,
  can,
  onConvert,
  onResizePreview,
  onResizeCommit,
  displayModes,
  onSetDisplayMode,
  onAutoFitWidth,
}: GridHeaderProps) {
  const moveColumnTo = useBoardStore((state) => state.moveColumnTo);
  const addColumn = useBoardStore((state) => state.addColumn);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    const columnId = event.dataTransfer.getData(COLUMN_MIME);
    setDragOverId(null);
    if (!columnId) return;

    event.preventDefault();
    void moveColumnTo(columnId, targetIndex);
  }

  /** A column added from anywhere opens ready to be named. */
  async function createColumn(type: ColumnType) {
    const created = await addColumn(type, COLUMN_TYPE_LABELS[type]);
    if (created) useGridStore.getState().beginColumnRename(created.id);
  }

  return (
    <div
      role="row"
      aria-rowindex={1}
      // A rung above the frozen column and the row gutter, which are `z-sticky`
      // and come later in the DOM: on the same rung the rows won the tie and
      // painted straight over the first two header cells, so scrolling looked
      // like the header's own left edge was being carried away with them.
      className="sticky top-0 z-sticky-header flex w-max border-b border-border bg-elevated"
    >
      <div
        style={{ width: GUTTER_WIDTH }}
        className="sticky left-0 z-sticky flex shrink-0 items-center border-r border-hairline bg-elevated px-1.5"
      >
        <Checkbox
          checked={selectionState === "all"}
          isIndeterminate={selectionState === "some"}
          aria-label={selectionState === "all" ? "Clear selection" : "Select all records"}
          onChange={onToggleAll}
        />
      </div>

      {columns.map((column, index) => (
        <HeaderCell
          key={column.id}
          column={column}
          columns={columns}
          index={index}
          can={can}
          isDragOver={dragOverId === column.id}
          displayMode={displayModes[column.id] ?? "compact"}
          onDragStateChange={setDragOverId}
          onDrop={handleDrop}
          onConvert={onConvert}
          onResizePreview={onResizePreview}
          onResizeCommit={onResizeCommit}
          onSetDisplayMode={onSetDisplayMode}
          onAutoFitWidth={onAutoFitWidth}
        />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!can("board.column.create")}
            aria-label="Add column"
            className="flex h-9 w-11 shrink-0 items-center justify-center border-r border-hairline text-faint-foreground hover:bg-hover hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>New column</DropdownMenuLabel>
          {(Object.keys(COLUMN_TYPE_LABELS) as ColumnType[]).map((type) => {
            const visual = columnVisual(type);

            return (
              <DropdownMenuItem key={type} onSelect={() => void createColumn(type)}>
                <visual.Icon />
                {COLUMN_TYPE_LABELS[type]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

interface HeaderCellProps {
  readonly column: BoardColumn;
  /** The whole schema — a select option rule can test any of it. */
  readonly columns: readonly BoardColumn[];
  readonly index: number;
  readonly can: PermissionResolver;
  readonly isDragOver: boolean;
  readonly displayMode: CellDisplayMode;
  readonly onDragStateChange: (id: string | null) => void;
  readonly onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
  readonly onConvert: (column: BoardColumn, type: ColumnType) => void;
  readonly onResizePreview: (columnId: string, width: number) => void;
  readonly onResizeCommit: (columnId: string, width: number) => void;
  readonly onSetDisplayMode: (columnId: string, mode: CellDisplayMode) => void;
  readonly onAutoFitWidth: (columnId: string) => void;
}

function HeaderCell({
  column,
  columns,
  index,
  can,
  isDragOver,
  displayMode,
  onDragStateChange,
  onDrop,
  onConvert,
  onResizePreview,
  onResizeCommit,
  onSetDisplayMode,
  onAutoFitWidth,
}: HeaderCellProps) {
  const renameColumn = useBoardStore((state) => state.renameColumn);

  /**
   * Whether *this* header is being renamed is board state, addressed by column
   * id: inserting a column has to be able to open the new column's field, and
   * it has no way to reach into a particular header's own `useState`.
   */
  const isRenaming = useGridStore(selectIsRenaming(column.id));

  /**
   * The typed name, stored with the column it was typed against.
   *
   * Derived rather than seeded by an effect: with nothing edited the field
   * simply shows `column.name`, so opening a rename always starts from what
   * the column is actually called and a name changed elsewhere is never
   * overwritten by a draft left behind.
   */
  const [edited, setEdited] = useState<{ columnId: string; value: string } | null>(null);
  const draftName = edited?.columnId === column.id ? edited.value : column.name;

  const visual = columnVisual(column.type);
  const canEditColumn = can("board.column.update");

  function beginRename() {
    if (canEditColumn) useGridStore.getState().beginColumnRename(column.id);
  }

  /**
   * Commit once, whether the field was left by Enter, by Tab or by clicking
   * away — the store's own rename flag is what makes the second call a no-op,
   * so there is no separate "did I already save" bookkeeping to get wrong.
   *
   * An empty or whitespace-only name is not a rename: the column keeps the name
   * it had, which is an answer the user can simply type over.
   */
  function commit() {
    const grid = useGridStore.getState();
    if (grid.renamingColumnId !== column.id) return;
    grid.endColumnRename();

    const trimmed = draftName.trim();
    setEdited(null);
    if (trimmed.length === 0 || trimmed === column.name) return;

    void renameColumn(column.id, trimmed);
  }

  function cancel() {
    setEdited(null);
    useGridStore.getState().endColumnRename();
  }

  function beginResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = column.width;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    let width = startWidth;

    const onMove = (move: globalThis.PointerEvent) => {
      width = clampColumnWidth(startWidth + (move.clientX - startX));
      onResizePreview(column.id, width);
    };

    const onUp = () => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      onResizeCommit(column.id, width);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  return (
    <div
      role="columnheader"
      aria-colindex={index + 1}
      // Never draggable while the field is open: a drag started on a text
      // selection inside it would take the column with it.
      draggable={!isRenaming && canEditColumn}
      onDragStart={(event) => {
        if (isRenaming) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(COLUMN_MIME, column.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(COLUMN_MIME)) return;
        event.preventDefault();
        onDragStateChange(column.id);
      }}
      onDragLeave={() => onDragStateChange(null)}
      onDrop={(event) => onDrop(event, index)}
      // Double-click anywhere on the header renames it. The two controls that
      // mean something else — the menu and the resize grip — stop the event
      // before it gets here, so this can never fire alongside one of them.
      onDoubleClick={() => {
        if (!isRenaming) beginRename();
      }}
      style={widthStyle(column.id, column.isPrimary)}
      className={cn(
        "group/head relative flex h-9 shrink-0 items-center gap-1.5 border-r border-hairline px-2",
        column.isPrimary && "sticky z-sticky bg-elevated",
        isDragOver && "bg-accent-soft",
      )}
    >
      <visual.Icon className="size-3.5 shrink-0 text-faint-foreground" />

      {isRenaming ? (
        <Input
          value={draftName}
          autoFocus
          aria-label={`Rename ${column.name}`}
          className="h-6 flex-1 text-ui"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setEdited({ columnId: column.id, value: event.target.value })}
          onBlur={commit}
          // Nothing typed here is the grid's business. The container above
          // runs the spreadsheet keyboard model, and without this every
          // letter opened a cell editor somewhere else and took the focus
          // with it — which is what made renaming look impossible.
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate text-left text-ui font-medium text-foreground"
          title={canEditColumn ? `${column.name} — double-click to rename` : column.name}
        >
          {column.name}
        </span>
      )}

      <ColumnMenu
        column={column}
        columns={columns}
        index={index}
        can={can}
        displayMode={displayMode}
        onRename={beginRename}
        onConvert={(type) => onConvert(column, type)}
        onSetDisplayMode={(mode) => onSetDisplayMode(column.id, mode)}
        onAutoFitWidth={() => onAutoFitWidth(column.id)}
      />

      {/* Drag to resize, double-click to fit — the spreadsheet gesture, in the
          spreadsheet's place. It stops the event because the header behind it
          renames on double-click, and the edge is not the title. */}
      <button
        type="button"
        aria-label={`Resize ${column.name} — double-click to fit its content`}
        title="Drag to resize · double-click to fit"
        onPointerDown={beginResize}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onAutoFitWidth(column.id);
        }}
        className="absolute -right-1 top-0 z-raised h-full w-2 cursor-col-resize touch-none hover:bg-accent/40"
      />
    </div>
  );
}
