"use client";

import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoardStore } from "@/store/board-store";

/** Row-level operations: duplicate and delete, both optimistic. */
export function RowActionsMenu({ rowId, displayId }: { rowId: string; displayId: string }) {
  const duplicateRow = useBoardStore((state) => state.duplicateRow);
  const deleteRow = useBoardStore((state) => state.deleteRow);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${displayId}`}
          className="hidden size-5 shrink-0 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-foreground focus-visible:flex group-hover/row:flex data-[state=open]:flex"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{displayId}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void duplicateRow(rowId)}>
          <Copy />
          Duplicate record
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void deleteRow(rowId)}>
          <Trash2 />
          Delete record
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
