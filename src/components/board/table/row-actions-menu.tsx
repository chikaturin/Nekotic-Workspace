"use client";

import { Archive, Copy, CornerDownRight, ListTree, MoreHorizontal, Trash2, Unlink } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { PermissionResolver } from "@/types";

interface RowActionsMenuProps {
  readonly rowId: string;
  readonly displayId: string;
  readonly can: PermissionResolver;
  readonly isSubtask: boolean;
}

export function RowActionsMenu({ rowId, displayId, can, isSubtask }: RowActionsMenuProps) {
  const duplicateRow = useBoardStore((state) => state.duplicateRow);
  const deleteRow = useBoardStore((state) => state.deleteRow);
  const bulkArchive = useBoardStore((state) => state.bulkArchive);
  const createSubtask = useBoardStore((state) => state.createSubtask);
  const setRowParent = useBoardStore((state) => state.setRowParent);
  const openDrawer = useGridStore((state) => state.openDrawer);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <>
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
          <DropdownMenuItem disabled={!can("row.create")} onSelect={() => void duplicateRow(rowId)}>
            <Copy />
            Duplicate record
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!can("row.create")}
            onSelect={() => {
              void createSubtask(rowId).then((id) => {
                if (id) openDrawer(id);
              });
            }}
          >
            <CornerDownRight />
            Add subtask
          </DropdownMenuItem>

          {isSubtask && (
            <DropdownMenuItem
              disabled={!can("row.move")}
              onSelect={() => void setRowParent(rowId, null)}
            >
              <Unlink />
              Move to the top level
            </DropdownMenuItem>
          )}

          <DropdownMenuItem disabled={!can("row.update")} onSelect={() => openDrawer(rowId)}>
            <ListTree />
            Open subtasks
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!can("row.archive")}
            onSelect={() => void bulkArchive([rowId], true)}
          >
            <Archive />
            Archive record
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="danger"
            disabled={!can("row.delete")}
            onSelect={() => setIsConfirmingDelete(true)}
          >
            <Trash2 />
            Delete record
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title={`Delete ${displayId}?`}
        description="Records are removed outright — the Trash holds files, pages and boards, not rows. This cannot be undone."
        confirmLabel="Delete record"
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          setIsConfirmingDelete(false);
          void deleteRow(rowId);
        }}
      />
    </>
  );
}
