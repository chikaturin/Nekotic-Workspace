"use client";

import { Folder, FolderInput, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { flattenTree, pathLabel } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isContainer } from "@/types";

interface MovePageDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onMove: (folderId: string | null) => void;
  /** Node being moved — it and its descendants are not valid destinations. */
  readonly nodeId: string;
  readonly currentParentId: string | null;
}

/** Folder picker for the Move action. */
export function MovePageDialog({
  isOpen,
  onClose,
  onMove,
  nodeId,
  currentParentId,
}: MovePageDialogProps) {
  const tree = useWorkspaceStore(selectTree);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const [query, setQuery] = useState("");

  const destinations = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return flattenTree(tree)
      .filter(isContainer)
      .filter((node) => node.id !== nodeId && !node.isTrashed)
      .filter((node) => needle.length === 0 || node.name.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [tree, nodeId, query]);

  function move(folderId: string | null) {
    onMove(folderId);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0">
        <header className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lead font-semibold text-foreground">
            <FolderInput className="size-4 text-muted-foreground" />
            Move page
          </DialogTitle>
          <DialogDescription className="text-ui text-muted-foreground">
            Pick the folder this page should live in.
          </DialogDescription>
        </header>

        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-faint-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search folders…"
              aria-label="Search folders"
              className="border-transparent bg-transparent px-0"
              autoFocus
            />
          </div>
        </div>

        <ul className="max-h-80 overflow-y-auto p-1.5">
          <li>
            <DestinationButton
              label={workspace.name}
              hint="Workspace root"
              isCurrent={currentParentId === null}
              onClick={() => move(null)}
            />
          </li>

          {destinations.map((node) => (
            <li key={node.id}>
              <DestinationButton
                label={node.name}
                hint={pathLabel(tree, node.id)}
                isCurrent={currentParentId === node.id}
                onClick={() => move(node.id)}
              />
            </li>
          ))}

          {destinations.length === 0 && (
            <li className="px-2 py-6 text-center text-lead text-muted-foreground">
              No folders match “{query}”
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

interface DestinationButtonProps {
  readonly label: string;
  readonly hint: string;
  readonly isCurrent: boolean;
  readonly onClick: () => void;
}

function DestinationButton({ label, hint, isCurrent, onClick }: DestinationButtonProps) {
  return (
    <Button
      variant="ghost"
      disabled={isCurrent}
      onClick={onClick}
      className={cn("h-auto w-full justify-start gap-2.5 px-2 py-2 text-left", isCurrent && "is-disabled")}
    >
      <Folder className="size-4 shrink-0 text-kind-folder" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lead text-foreground">{label}</span>
        <span className="metric block truncate text-micro text-faint-foreground">{hint}</span>
      </span>
      {isCurrent && <span className="metric shrink-0 text-micro text-faint-foreground">current</span>}
    </Button>
  );
}
