"use client";

import { motion } from "framer-motion";
import { Expand, Star, Users } from "lucide-react";
import { DriveItemMenu } from "@/components/drive/drive-item-menu";
import { describeNode } from "@/components/drive/node-meta";
import { useDragSource, useDropTarget } from "@/hooks/use-node-dnd";
import { useOpenNode } from "@/hooks/use-open-node";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isContainer, isFile, type DriveNode } from "@/types";

const CARD_MOTION = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

interface DriveItemCardProps {
  readonly node: DriveNode;
  readonly href: string;
  readonly isSelected: boolean;
  readonly onSelect: (nodeId: string, additive: boolean) => void;
}

/**
 * Grid tile: thumbnail for images, icon plate otherwise, drop target for folders.
 * The motion wrapper stays separate from the interactive element — framer-motion
 * owns `onDragStart` for its gesture system, which would shadow native HTML5 DnD.
 */
export function DriveItemCard({ node, href, isSelected, onSelect }: DriveItemCardProps) {
  const openNode = useOpenNode();
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const { Icon, colorClass, tintClass, label } = nodeVisual(node);
  const { dragProps, isDragging } = useDragSource(node);
  const { dropProps, isOver } = useDropTarget({ targetId: node.id, disabled: !isContainer(node) });

  const thumbnail = isFile(node) ? node.thumbnailUrl : undefined;

  function activate() {
    if (isFile(node)) {
      openPreview(node.id);
      return;
    }
    openNode(href);
  }

  return (
    <motion.div variants={CARD_MOTION} layout="position" className="min-w-0">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${node.name}`}
        onClick={(event) => onSelect(node.id, event.metaKey || event.ctrlKey)}
        onDoubleClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter") activate();
        }}
        className={cn(
          "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-surface outline-none transition-colors",
          "hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "border-accent bg-selection" : "border-border",
          isOver && "border-accent bg-accent-soft ring-1 ring-accent",
          isDragging && "opacity-40",
        )}
        {...dragProps}
        {...dropProps}
      >
        <div
          className={cn(
            "relative flex h-24 items-center justify-center overflow-hidden border-b border-hairline",
            thumbnail ? "bg-canvas" : tintClass,
          )}
        >
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URI, no loader needed
            <img src={thumbnail} alt="" className="size-full object-cover" draggable={false} />
          ) : (
            <Icon className={cn("size-8", colorClass)} strokeWidth={1.5} />
          )}

          {isFile(node) && (
            <button
              type="button"
              aria-label={`Preview ${node.name}`}
              onClick={(event) => {
                event.stopPropagation();
                openPreview(node.id);
              }}
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 backdrop-blur-[1px]",
                "transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none",
              )}
            >
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] font-medium text-foreground shadow-lg">
                <Expand className="size-3.5" />
                Preview
              </span>
            </button>
          )}

          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            {node.isFavorite && <Star className="size-3.5 fill-accent text-accent drop-shadow" />}
            <DriveItemMenu
              node={node}
              href={href}
              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon className={cn("size-3.5 shrink-0", colorClass)} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {node.name}
            </span>
            {node.isShared && <Users className="size-3 shrink-0 text-faint-foreground" />}
          </div>
          <span className="metric truncate text-[10px] text-faint-foreground">{describeNode(node)}</span>
        </div>
      </div>
    </motion.div>
  );
}
