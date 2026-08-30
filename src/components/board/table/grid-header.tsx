"use client";

import { Plus } from "lucide-react";
import { memo, useState, type DragEvent, type PointerEvent } from "react";
import { ColumnMenu } from "@/components/board/table/column-menu";
import { RelationColumnDialog } from "@/components/board/config/relation-column-dialog";
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
import { useBoardFolderId } from "@/hooks/use-folder-boards";
import { useBoardStore } from "@/store/board-store";
import { selectIsRenaming, useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";
import type { BoardColumn, CellDisplayMode, ColumnType, PermissionResolver } from "@/types";

const COLUMN_MIME = "application/x-nekotic-column";

export type SelectionState = "none" | "some" | "all";

interface GridHeaderProps {
  readonly columns: readonly BoardColumn[];
  readonly selectionState: SelectionState;
  readonly onToggleAll: () => void;
  readonly can: PermissionResolver;
  readonly onConvert: (column: BoardColumn, type: ColumnType) => void;
  readonly onResizePreview: (columnId: string, width: number) => void;
  readonly onResizeCommit: (columnId: string, width: number) => void;
  readonly displayModes: Readonly<Record<string, CellDisplayMode>>;
  readonly onSetDisplayMode: (columnId: string, mode: CellDisplayMode) => void;
  readonly onAutoFitWidth: (columnId: string) => void;
}

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
  const nodeId = useBoardStore((state) => state.nodeId);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isPickingBoard, setIsPickingBoard] = useState(false);

  const folderId = useBoardFolderId();

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    const columnId = event.dataTransfer.getData(COLUMN_MIME);
    setDragOverId(null);
    if (!columnId) return;

    event.preventDefault();
    void moveColumnTo(columnId, targetIndex);
  }

  async function createColumn(type: ColumnType) {
    if (type === "relation") {
      setIsPickingBoard(true);
      return;
    }

    const created = await addColumn(type, COLUMN_TYPE_LABELS[type]);
    if (created) useGridStore.getState().beginColumnRename(created.id);
  }

  return (
    <div
      role="row"
      aria-rowindex={1}
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

      <RelationColumnDialog
        key={isPickingBoard ? "open" : "closed"}
        isOpen={isPickingBoard}
        column={null}
        folderId={folderId}
        currentNodeId={nodeId ?? ""}
        onClose={() => setIsPickingBoard(false)}
        onSave={({ name, config }) => {
          setIsPickingBoard(false);
          void addColumn("relation", name, undefined, config);
        }}
      />
    </div>
  );
});

interface HeaderCellProps {
  readonly column: BoardColumn;
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

  const isRenaming = useGridStore(selectIsRenaming(column.id));

  const [edited, setEdited] = useState<{ columnId: string; value: string } | null>(null);
  const draftName = edited?.columnId === column.id ? edited.value : column.name;

  const visual = columnVisual(column.type);
  const canEditColumn = can("board.column.update");

  function beginRename() {
    if (canEditColumn) useGridStore.getState().beginColumnRename(column.id);
  }

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
