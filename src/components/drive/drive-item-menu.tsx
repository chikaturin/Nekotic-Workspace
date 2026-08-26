"use client";

import {
  Archive,
  ArchiveRestore,
  Download,
  Ellipsis,
  ExternalLink,
  PenLine,
  Share2,
  ShieldCheck,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PermissionDialog } from "@/components/permissions/permission-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileDownload } from "@/hooks/use-file-preview";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isArchivedNode } from "@/lib/archive";
import { isFile, type DriveNode } from "@/types";

interface DriveItemMenuProps {
  readonly node: DriveNode;
  readonly href: string;
  readonly className?: string;
}

/** Row/card overflow actions. Shared so both layouts stay in sync. */
export function DriveItemMenu({ node, href, className }: DriveItemMenuProps) {
  const router = useRouter();
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite);
  const trashNode = useWorkspaceStore((state) => state.trashNode);
  const requestRename = useWorkspaceStore((state) => state.requestRename);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const setNodeArchived = useWorkspaceStore((state) => state.setNodeArchived);
  const can = usePermissions(node);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const downloadFile = useFileDownload();
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  /**
   * A toast that says "copied" while nothing reached the clipboard is worse
   * than no button at all, so the message follows the write rather than
   * announcing it in advance.
   */
  async function copyShareLink() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      pushFeedback(`Share link copied for “${node.name}”`, "success");
    } catch {
      pushFeedback("Could not reach the clipboard — copy the address bar instead", "error");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Actions for ${node.name}`}
          onClick={(event) => event.stopPropagation()}
          className={cn("shrink-0", className)}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() => (node.type === "file" ? openPreview(node.id) : router.push(href))}
        >
          <ExternalLink />
          {node.type === "file" ? "Preview" : "Open"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggleFavorite(node.id)}>
          {node.isFavorite ? <StarOff /> : <Star />}
          {node.isFavorite ? "Remove from favorites" : "Add to favorites"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!can("node.rename")}
          onSelect={() => requestRename(node.id)}
        >
          <PenLine />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!can("node.share")} onSelect={() => void copyShareLink()}>
          <Share2 />
          Copy share link
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!can("workspace.permission.manage")}
          onSelect={() => setIsAccessOpen(true)}
        >
          <ShieldCheck />
          Manage access
        </DropdownMenuItem>
        {isFile(node) && (
          <DropdownMenuItem onSelect={() => void downloadFile(node)}>
            <Download />
            Download
          </DropdownMenuItem>
        )}

        {/* Files have no read-only mode of their own, so they are not archived —
            they are moved to Trash or left where they are. */}
        {!isFile(node) && (
          <DropdownMenuItem
            // An inherited freeze cannot be lifted from here at all: the
            // resolver has already closed the key for everything below the
            // ancestor that holds it.
            disabled={!can("node.archive")}
            onSelect={() => setNodeArchived(node.id, !isArchivedNode(node))}
          >
            {isArchivedNode(node) ? <ArchiveRestore /> : <Archive />}
            {isArchivedNode(node) ? "Restore from archive" : "Archive"}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          disabled={!can("node.delete")}
          onSelect={() => trashNode(node.id)}
        >
          <Trash2 />
          Move to Trash
        </DropdownMenuItem>
      </DropdownMenuContent>

      <PermissionDialog
        node={node}
        isOpen={isAccessOpen}
        onClose={() => setIsAccessOpen(false)}
      />
    </DropdownMenu>
  );
}
