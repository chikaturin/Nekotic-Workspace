"use client";

import {
  Archive,
  ArchiveRestore,
  CopyPlus,
  Ellipsis,
  FolderInput,
  LoaderCircle,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentActions } from "@/hooks/use-document-actions";
import type { CapabilitySet, WorkspaceDocument } from "@/types";

interface DocumentActionsMenuProps {
  readonly document: WorkspaceDocument;
  readonly actions: DocumentActions;
  /** Capabilities before the lock is applied, so unlocking stays possible. */
  readonly capabilities: CapabilitySet;
  readonly onMoveRequested: () => void;
}

/** Pin · Lock · Duplicate · Move · Archive · Delete, each capability-gated. */
export function DocumentActionsMenu({
  document,
  actions,
  capabilities,
  onMoveRequested,
}: DocumentActionsMenuProps) {
  const isBusy = actions.pending !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline" aria-label="Page actions" disabled={isBusy}>
          {isBusy ? <LoaderCircle className="animate-spin" /> : <Ellipsis />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Page</DropdownMenuLabel>

        <DropdownMenuItem onSelect={() => void actions.togglePin()}>
          {document.isPinned ? <PinOff /> : <Pin />}
          {document.isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!actions.canToggleLock}
          onSelect={() => void actions.toggleLock()}
        >
          {document.isLocked ? <LockOpen /> : <Lock />}
          {document.isLocked ? "Unlock page" : "Lock page"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!capabilities.edit} onSelect={() => void actions.duplicate()}>
          <CopyPlus />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!capabilities.edit} onSelect={onMoveRequested}>
          <FolderInput />
          Move to…
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!capabilities.edit}
          onSelect={() => void actions.setArchived(!document.isArchived)}
        >
          {document.isArchived ? <ArchiveRestore /> : <Archive />}
          {document.isArchived ? "Restore from archive" : "Archive"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="danger"
          disabled={!capabilities.delete}
          onSelect={() => void actions.remove()}
        >
          <Trash2 />
          Move to Trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
