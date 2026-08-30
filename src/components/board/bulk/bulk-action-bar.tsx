"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  CircleSlash,
  Download,
  FolderInput,
  LoaderCircle,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";
import { BulkMoveDialog } from "@/components/board/bulk/bulk-move-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BulkActionsController } from "@/hooks/use-bulk-actions";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { formatCount } from "@/lib/format";
import type { DirectoryUser, PermissionResolver } from "@/types";

interface BulkActionBarProps {
  readonly controller: BulkActionsController;
  readonly people: readonly DirectoryUser[];
  readonly currentBoardId: string;
  readonly can: PermissionResolver;
  readonly onExport: () => void;
}

export function BulkActionBar({
  controller,
  people,
  currentBoardId,
  can,
  onExport,
}: BulkActionBarProps) {
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { count, archivedCount, isRunning, statusColumn, assigneeColumn } = controller;
  const isVisible = count > 0;
  const allArchived = count > 0 && archivedCount === count;

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-none absolute inset-x-0 bottom-4 z-dropdown flex justify-center px-4"
          >
            <div
              role="toolbar"
              aria-label="Bulk actions"
              className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-border bg-elevated/95 px-2 py-1.5 shadow-float backdrop-blur"
            >
              <span className="flex items-center gap-1.5 pl-1 pr-1.5">
                <Badge variant="count">{count}</Badge>
                <span className="text-ui text-foreground">
                  {count === 1 ? "record" : "records"} selected
                </span>
                {archivedCount > 0 && !allArchived && (
                  <span className="metric text-micro text-faint-foreground">
                    · {archivedCount} archived will be skipped
                  </span>
                )}
              </span>

              <span className="h-5 w-px bg-hairline" aria-hidden />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={!can("row.update") || !statusColumn || isRunning}
                    title={statusColumn ? undefined : "This board has no status column"}
                  >
                    <CircleSlash />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-52">
                  <DropdownMenuLabel>{statusColumn?.name ?? "Status"}</DropdownMenuLabel>
                  {statusColumn?.config.options.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => void controller.setStatus(option.id)}
                    >
                      <span
                        aria-hidden
                        className={`size-2.5 rounded-full border ${SELECT_COLOR_CLASSES[option.color]}`}
                      />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void controller.setStatus(null)}>
                    <CircleSlash />
                    Clear status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={!can("row.update") || !assigneeColumn || isRunning}
                    title={assigneeColumn ? undefined : "This board has no people column"}
                  >
                    <UserPlus />
                    Assign
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <DropdownMenuLabel>{assigneeColumn?.name ?? "Assignee"}</DropdownMenuLabel>
                  {people
                    .filter((person) => person.isActive)
                    .map((person) => (
                      <DropdownMenuItem
                        key={person.id}
                        onSelect={() => void controller.assign([person.id])}
                      >
                        <UserAvatar user={person} className="size-4" />
                        {person.name}
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void controller.assign([])}>
                    <CircleSlash />
                    Unassign
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={!can("row.delete") || isRunning}
                onClick={() => setIsMoveOpen(true)}
              >
                <FolderInput />
                Move
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={!can("row.archive") || isRunning}
                onClick={() => void controller.setArchived(!allArchived)}
              >
                {allArchived ? <ArchiveRestore /> : <Archive />}
                {allArchived ? "Restore" : "Archive"}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={!can("board.export")}
                onClick={onExport}
              >
                <Download />
                Export
              </Button>

              <Button
                size="sm"
                variant="danger"
                className="gap-1.5"
                disabled={!can("row.delete") || isRunning}
                onClick={() => setIsDeleteOpen(true)}
              >
                {isRunning ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                Delete
              </Button>

              <span className="h-5 w-px bg-hairline" aria-hidden />

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Clear selection"
                onClick={controller.clear}
              >
                <X />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkMoveDialog
        isOpen={isMoveOpen}
        count={count}
        currentBoardId={currentBoardId}
        isBusy={isRunning}
        onClose={() => setIsMoveOpen(false)}
        onMove={(targetNodeId, targetName) => {
          setIsMoveOpen(false);
          void controller.move(targetNodeId, targetName);
        }}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title={`Delete ${formatCount(count, "record")}?`}
        description="Records are removed outright — the Trash holds files, pages and boards, not rows. This cannot be undone."
        confirmLabel="Delete records"
        isBusy={isRunning}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          setIsDeleteOpen(false);
          void controller.remove();
        }}
      />
    </>
  );
}
