"use client";

import { Download, Ellipsis, ExternalLink, PenLine, Share2, Star, StarOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isContainer, type DriveNode } from "@/types";

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
  const renameNode = useWorkspaceStore((state) => state.renameNode);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  function handleRename() {
    const next = window.prompt("Rename item", node.name);
    if (next !== null) renameNode(node.id, next);
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
        <DropdownMenuItem onSelect={handleRename}>
          <PenLine />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => pushFeedback(`Share link copied for “${node.name}”`, "success")}>
          <Share2 />
          Copy share link
        </DropdownMenuItem>
        {!isContainer(node) && (
          <DropdownMenuItem onSelect={() => pushFeedback("Download is not wired in this mock")}>
            <Download />
            Download
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={() => trashNode(node.id)}>
          <Trash2 />
          Move to Trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
