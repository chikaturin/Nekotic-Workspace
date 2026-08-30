"use client";

import {
  Archive,
  ArchiveRestore,
  Download,
  Ellipsis,
  ExternalLink,
  Lock,
  PenLine,
  Pin,
  PinOff,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { NodeAccessDialog } from "@/components/permissions/node-access-dialog";
import { PermissionDialog } from "@/components/permissions/permission-dialog";
import { FavoriteStar } from "@/components/shared/favorite-star";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileDownload } from "@/hooks/use-file-preview";
import { useOpenNode } from "@/hooks/use-open-node";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isArchivedNode } from "@/lib/archive";
import { isFile, type DriveNode } from "@/types";

interface DriveItemMenuProps {
  readonly node: DriveNode;
  readonly href: string;
  readonly className?: string;
  /** Dáng của nút mở menu — thanh công cụ dùng nút viền cỡ thường, các dòng danh sách dùng nút chìm cỡ nhỏ. */
  readonly trigger?: "row" | "toolbar";
}

const TRIGGER_LOOK = {
  row: { size: "icon-sm", variant: "ghost" },
  toolbar: { size: "icon", variant: "outline" },
} as const;

export function DriveItemMenu({ node, href, className, trigger = "row" }: DriveItemMenuProps) {
  const openNode = useOpenNode();
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite);
  const togglePinned = useWorkspaceStore((state) => state.togglePinned);
  const trashNode = useWorkspaceStore((state) => state.trashNode);
  const requestRename = useWorkspaceStore((state) => state.requestRename);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const setNodeArchived = useWorkspaceStore((state) => state.setNodeArchived);
  const can = usePermissions(node);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const downloadFile = useFileDownload();
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [isRolesOpen, setIsRolesOpen] = useState(false);

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
          size={TRIGGER_LOOK[trigger].size}
          variant={TRIGGER_LOOK[trigger].variant}
          aria-label={`Actions for ${node.name}`}
          onClick={(event) => event.stopPropagation()}
          className={cn("shrink-0", className)}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() => (node.type === "file" ? openPreview(node.id) : openNode(href))}
        >
          <ExternalLink />
          {node.type === "file" ? "Preview" : "Open"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => togglePinned(node.id)}>
          {node.isPinned ? <PinOff /> : <Pin />}
          {node.isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => toggleFavorite(node.id)}>
          <FavoriteStar isFavorite={node.isFavorite} />
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
          disabled={!can("node.access.manage")}
          onSelect={() => setIsAccessOpen(true)}
        >
          <Lock />
          Manage access
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!can("workspace.permission.manage")}
          onSelect={() => setIsRolesOpen(true)}
        >
          <ShieldCheck />
          Roles on this item
        </DropdownMenuItem>
        {isFile(node) && (
          <DropdownMenuItem onSelect={() => void downloadFile(node)}>
            <Download />
            Download
          </DropdownMenuItem>
        )}

        {!isFile(node) && (
          <DropdownMenuItem
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

      <NodeAccessDialog
        node={node}
        isOpen={isAccessOpen}
        onClose={() => setIsAccessOpen(false)}
      />

      <PermissionDialog
        node={node}
        isOpen={isRolesOpen}
        onClose={() => setIsRolesOpen(false)}
      />
    </DropdownMenu>
  );
}
