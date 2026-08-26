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
import { cn } from "@/lib/utils";
import type { BoardColumn, ColumnType, PermissionResolver } from "@/types";

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

  return (
    <div
      role="row"
      aria-rowindex={1}
      className="sticky top-0 z-40 flex w-max border-b border-border bg-elevated"
    >
      <div
        style={{ width: GUTTER_WIDTH }}
        className="sticky left-0 z-10 flex shrink-0 items-center border-r border-hairline bg-elevated px-1.5"
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
          onDragStateChange={setDragOverId}
          onDrop={handleDrop}
          onConvert={onConvert}
          onResizePreview={onResizePreview}
          onResizeCommit={onResizeCommit}
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
              <DropdownMenuItem
                key={type}
                onSelect={() => void addColumn(type, COLUMN_TYPE_LABELS[type])}
              >
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
  readonly onDragStateChange: (id: string | null) => void;
  readonly onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
  readonly onConvert: (column: BoardColumn, type: ColumnType) => void;
  readonly onResizePreview: (columnId: string, width: number) => void;
  readonly onResizeCommit: (columnId: string, width: number) => void;
}

function HeaderCell({
  column,
  columns,
  index,
  can,
  isDragOver,
  onDragStateChange,
  onDrop,
  onConvert,
  onResizePreview,
  onResizeCommit,
}: HeaderCellProps) {
  const renameColumn = useBoardStore((state) => state.renameColumn);
  const [draftName, setDraftName] = useState<string | null>(null);
  const visual = columnVisual(column.type);
  const canEditColumn = can("board.column.update");

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
      draggable={draftName === null && canEditColumn}
      onDragStart={(event) => {
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
      style={widthStyle(column.id, column.isPrimary)}
      className={cn(
        "group/head relative flex h-9 shrink-0 items-center gap-1.5 border-r border-hairline px-2",
        column.isPrimary && "sticky z-10 bg-elevated",
        isDragOver && "bg-accent-soft",
      )}
    >
      <visual.Icon className="size-3.5 shrink-0 text-faint-foreground" />

      {draftName === null ? (
        <button
          type="button"
          onDoubleClick={() => {
            if (canEditColumn) setDraftName(column.name);
          }}
          className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-foreground"
        >
          {column.name}
        </button>
      ) : (
        <Input
          value={draftName}
          autoFocus
          aria-label="Column name"
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            if (draftName.trim()) void renameColumn(column.id, draftName.trim());
            setDraftName(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDraftName(null);
            }
          }}
          className="h-6 flex-1 text-[12px]"
        />
      )}

      <ColumnMenu
        column={column}
        columns={columns}
        can={can}
        onRename={() => setDraftName(column.name)}
        onConvert={(type) => onConvert(column, type)}
      />

      <button
        type="button"
        aria-label={`Resize ${column.name}`}
        onPointerDown={beginResize}
        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-accent/40"
      />
    </div>
  );
}
