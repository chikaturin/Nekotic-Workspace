"use client";

import { motion } from "framer-motion";
import { Download, Ellipsis, Eye, Trash2 } from "lucide-react";
import { FavoriteStar } from "@/components/shared/favorite-star";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatBytes, formatDate } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import type { CapabilitySet, FileNode } from "@/types";

const GRID_CLASS =
  "grid items-center gap-3 grid-cols-[minmax(0,1fr)_72px_36px] sm:grid-cols-[minmax(0,1fr)_88px_84px_36px] lg:grid-cols-[minmax(0,1fr)_96px_150px_84px_104px_36px]";

const ROW_MOTION = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
};

interface FileTableProps {
  readonly files: readonly FileNode[];
  readonly capabilities: CapabilitySet;
  readonly onPreview: (nodeId: string) => void;
  readonly onDownload: (node: FileNode) => void;
  readonly onToggleFavorite: (nodeId: string) => void;
  readonly onTrash: (nodeId: string) => void;
}

export function FileTable({
  files,
  capabilities,
  onPreview,
  onDownload,
  onToggleFavorite,
  onTrash,
}: FileTableProps) {
  return (
    <div role="table" aria-label="Files">
      <div
        role="row"
        className={cn(
          GRID_CLASS,
          "h-8 border-b border-border px-2.5 text-micro font-semibold uppercase tracking-wider text-faint-foreground",
        )}
      >
        <span role="columnheader">Name</span>
        <span role="columnheader">Type</span>
        <span role="columnheader" className="hidden lg:block">
          Owner
        </span>
        <span role="columnheader" className="hidden sm:block">
          Size
        </span>
        <span role="columnheader" className="hidden lg:block">
          Created
        </span>
        <span />
      </div>

      <motion.div
        role="rowgroup"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.015 } } }}
        className="flex flex-col pt-1"
      >
        {files.map((file) => {
          const { Icon, colorClass, label } = nodeVisual(file);

          return (
            <motion.div
              key={file.id}
              variants={ROW_MOTION}
              role="row"
              tabIndex={0}
              onClick={() => onPreview(file.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onPreview(file.id);
              }}
              className={cn(
                GRID_CLASS,
                "group h-11 cursor-pointer rounded-md px-2.5 outline-none transition-colors",
                "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <div role="cell" className="flex min-w-0 items-center gap-2">
                <Icon className={cn("size-4 shrink-0", colorClass)} />
                <span className="min-w-0 truncate text-lead text-foreground">{file.name}</span>
                {file.isFavorite && <FavoriteStar isFavorite className="size-3 shrink-0" />}
              </div>

              <span role="cell" className="metric truncate text-body text-faint-foreground">
                {label}
              </span>

              <div role="cell" className="hidden min-w-0 items-center gap-1.5 lg:flex">
                <UserAvatar user={file.owner} className="size-5" />
                <span className="truncate text-body text-muted-foreground">{file.owner.name}</span>
              </div>

              <span
                role="cell"
                className="metric hidden truncate text-body text-faint-foreground sm:block"
              >
                {formatBytes(file.sizeBytes)}
              </span>

              <span
                role="cell"
                className="metric hidden truncate text-body text-faint-foreground lg:block"
              >
                {formatDate(file.createdAt)}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Actions for ${file.name}`}
                    onClick={(event) => event.stopPropagation()}
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                  >
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => onPreview(file.id)}>
                    <Eye />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onDownload(file)}>
                    <Download />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggleFavorite(file.id)}>
                    <FavoriteStar isFavorite={file.isFavorite} />
                    {file.isFavorite ? "Remove from favorites" : "Add to favorites"}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="danger"
                    disabled={!capabilities.delete}
                    onSelect={() => onTrash(file.id)}
                  >
                    <Trash2 />
                    Move to Trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
