"use client";

import {
  ArrowDownAZ,
  ArrowUpAZ,
  EyeOff,
  Link2,
  MoreHorizontal,
  Pencil,
  Shuffle,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { SelectColumnDialog } from "@/components/board/config/select-column-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useBoardList } from "@/hooks/use-board-list";
import { COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn, ColumnType, PermissionResolver } from "@/types";

interface ColumnMenuProps {
  readonly column: BoardColumn;
  /** Every column on the board — what an option rule can be written against. */
  readonly columns: readonly BoardColumn[];
  /**
   * Reshaping a column is a manager's job; sorting and hiding one is how
   * anybody reads a board. The menu holds both, so it asks per item rather
   * than being handed a single "read only" flag for all of them.
   */
  readonly can: PermissionResolver;
  readonly onRename: () => void;
  readonly onConvert: (type: ColumnType) => void;
}

const TYPES = Object.keys(COLUMN_TYPE_LABELS) as readonly ColumnType[];

/** Everything a column can do, at the header where the user is looking. */
export function ColumnMenu({ column, columns, can, onRename, onConvert }: ColumnMenuProps) {
  const setSort = useBoardStore((state) => state.setSort);
  const people = useBoardStore((state) => state.people);
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);
  const deleteColumn = useBoardStore((state) => state.deleteColumn);
  const updateColumnConfig = useBoardStore((state) => state.updateColumnConfig);
  const boards = useBoardList();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfiguringSelect, setIsConfiguringSelect] = useState(false);

  const canEditSchema = can("board.column.update");

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${column.name} column options`}
          className="flex size-5 shrink-0 items-center justify-center rounded text-faint-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/head:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{column.name}</DropdownMenuLabel>

        <DropdownMenuItem disabled={!canEditSchema} onSelect={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!canEditSchema}>
            <Shuffle />
            Change type
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {TYPES.map((type) => (
              <DropdownMenuItem
                key={type}
                disabled={type === column.type}
                onSelect={() => onConvert(type)}
              >
                {COLUMN_TYPE_LABELS[type]}
                {type === column.type && (
                  <span className="ml-auto text-[10px] text-faint-foreground">current</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {column.type === "select" && (
          <DropdownMenuItem
            disabled={!canEditSchema}
            onSelect={() => setIsConfiguringSelect(true)}
          >
            <SlidersHorizontal />
            Options &amp; rules…
          </DropdownMenuItem>
        )}

        {column.type === "relation" && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!canEditSchema}>
              <Link2 />
              Linked board
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.boardId}
                  disabled={column.config.boardId === board.boardId}
                  onSelect={() =>
                    void updateColumnConfig(column.id, { config: { boardId: board.boardId } })
                  }
                >
                  {board.name}
                  {column.config.boardId === board.boardId && (
                    <span className="ml-auto text-[10px] text-faint-foreground">linked</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void setSort(column.id, "asc")}>
          <ArrowUpAZ />
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void setSort(column.id, "desc")}>
          <ArrowDownAZ />
          Sort descending
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={column.isPrimary}
          onSelect={() => void setColumnHidden(column.id, true)}
        >
          <EyeOff />
          Hide column
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="danger"
          disabled={column.isPrimary || !can("board.column.delete")}
          onSelect={() => setIsConfirmingDelete(true)}
        >
          <Trash2 />
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>

      {/* Deleting a column takes its value out of every record on the board.
          Nothing else in the app destroys that much from a single menu item. */}
      {/* Options, their conditions and the transition table are one write:
          the dialog commits a whole config so a half-written rule never lands. */}
      <SelectColumnDialog
        column={isConfiguringSelect && column.type === "select" ? column : null}
        columns={columns}
        people={people}
        onClose={() => setIsConfiguringSelect(false)}
        onSave={(config) => void updateColumnConfig(column.id, { config })}
      />

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title={`Delete the “${column.name}” column?`}
        description="Its value is removed from every record on this board, and from every view that referenced it. This cannot be undone."
        confirmLabel="Delete column"
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          setIsConfirmingDelete(false);
          void deleteColumn(column.id);
        }}
      />
    </>
  );
}
