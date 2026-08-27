"use client";

import { motion } from "framer-motion";
import { Star, Users } from "lucide-react";
import { DriveItemMenu } from "@/components/drive/drive-item-menu";
import { sizeLabel, typeLabel } from "@/components/drive/node-meta";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useDragSource, useDropTarget } from "@/hooks/use-node-dnd";
import { useOpenNode } from "@/hooks/use-open-node";
import { formatRelativeTime } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isContainer, isFile, type DriveNode } from "@/types";

export const LIST_GRID_CLASS =
  "grid items-center gap-3 grid-cols-[minmax(0,1fr)_88px_36px] sm:grid-cols-[minmax(0,1fr)_88px_96px_36px] lg:grid-cols-[minmax(0,1fr)_96px_150px_88px_104px_36px]";

const ROW_MOTION = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
};

interface DriveItemRowProps {
  readonly node: DriveNode;
  readonly href: string;
  readonly isSelected: boolean;
  readonly onSelect: (nodeId: string, additive: boolean) => void;
}

export function DriveItemRow({ node, href, isSelected, onSelect }: DriveItemRowProps) {
  const openNode = useOpenNode();
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const { Icon, colorClass } = nodeVisual(node);
  const { dragProps, isDragging } = useDragSource(node);
  const { dropProps, isOver } = useDropTarget({ targetId: node.id, disabled: !isContainer(node) });

  function activate() {
    if (isFile(node)) {
      openPreview(node.id);
      return;
    }
    openNode(href);
  }

  return (
    <motion.div variants={ROW_MOTION}>
      <div
        role="row"
        tabIndex={0}
        onClick={(event) => onSelect(node.id, event.metaKey || event.ctrlKey)}
        onDoubleClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter") activate();
        }}
        className={cn(
          LIST_GRID_CLASS,
          "group h-11 cursor-pointer rounded-md border border-transparent px-2.5 outline-none transition-colors",
          "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && "border-accent/40 bg-selection",
          isOver && "border-accent bg-accent-soft",
          isDragging && "opacity-40",
        )}
        {...dragProps}
        {...dropProps}
      >
        <div role="cell" className="flex min-w-0 items-center gap-2">
          <Icon className={cn("size-4 shrink-0", colorClass)} />
          <span className="min-w-0 truncate text-[13px] text-foreground">{node.name}</span>
          {node.isFavorite && <Star className="size-3 shrink-0 fill-accent text-accent" />}
          {node.isShared && <Users className="size-3 shrink-0 text-faint-foreground" />}
        </div>

        <span role="cell" className="metric truncate text-[11px] text-faint-foreground">
          {typeLabel(node)}
        </span>

        <div role="cell" className="hidden min-w-0 items-center gap-1.5 lg:flex">
          <UserAvatar user={node.owner} className="size-5" />
          <span className="truncate text-[11px] text-muted-foreground">{node.owner.name}</span>
        </div>

        <span
          role="cell"
          className="metric hidden truncate text-[11px] text-faint-foreground sm:block"
        >
          {sizeLabel(node)}
        </span>

        <span
          role="cell"
          className="metric hidden truncate text-[11px] text-faint-foreground lg:block"
        >
          {formatRelativeTime(node.updatedAt)}
        </span>

        <DriveItemMenu
          node={node}
          href={href}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        />
      </div>
    </motion.div>
  );
}
