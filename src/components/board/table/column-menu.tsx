"use client";

import {
  ArrowDownAZ,
  ArrowUpAZ,
  EyeOff,
  Link2,
  MoreHorizontal,
  Pencil,
  Shuffle,
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
import { useBoardList } from "@/hooks/use-board-list";
import { COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn, ColumnType } from "@/types";

interface ColumnMenuProps {
  readonly column: BoardColumn;
  readonly onRename: () => void;
  readonly onConvert: (type: ColumnType) => void;
}

const TYPES = Object.keys(COLUMN_TYPE_LABELS) as readonly ColumnType[];

/** Everything a column can do, at the header where the user is looking. */
export function ColumnMenu({ column, onRename, onConvert }: ColumnMenuProps) {
  const setSort = useBoardStore((state) => state.setSort);
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);
  const deleteColumn = useBoardStore((state) => state.deleteColumn);
  const updateColumnConfig = useBoardStore((state) => state.updateColumnConfig);
  const boards = useBoardList();

  return (
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

        <DropdownMenuItem onSelect={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
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

        {column.type === "relation" && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
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
          disabled={column.isPrimary}
          onSelect={() => void deleteColumn(column.id)}
        >
          <Trash2 />
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
