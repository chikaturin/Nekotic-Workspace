"use client";

import { Archive, Copy, MoreHorizontal, Trash2 } from "lucide-react";
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
import type { PermissionResolver } from "@/types";

interface RowActionsMenuProps {
  readonly rowId: string;
  readonly displayId: string;
  /**
   * Bound resolver. Duplicating a record is adding one; archiving and deleting
   * are not — three different keys behind three items that used to share one.
   */
  readonly can: PermissionResolver;
}

/** Row-level operations: duplicate, archive and delete, all optimistic. */
export function RowActionsMenu({ rowId, displayId, can }: RowActionsMenuProps) {
  const duplicateRow = useBoardStore((state) => state.duplicateRow);
  const deleteRow = useBoardStore((state) => state.deleteRow);
  const bulkArchive = useBoardStore((state) => state.bulkArchive);
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

      {/* Records have no bin — deleting one here is exactly as final as the
          bulk delete, so it asks in exactly the same way. */}
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
