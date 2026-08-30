"use client";

import { ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";
import { DriveItemMenu } from "@/components/drive/drive-item-menu";
import { TREE_INDENT } from "@/config/app";
import { useDragSource, useDropTarget } from "@/hooks/use-node-dnd";
import { routableHref } from "@/lib/exported-routes";
import { nodeVisual } from "@/lib/node-visuals";
import { AccessBadge } from "@/components/shared/access-badge";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isContainer, type DriveNode } from "@/types";

export interface TreeRowProps {
  readonly node: DriveNode;
  readonly depth: number;
  readonly href: string;
  readonly isExpanded: boolean;
  readonly isActive: boolean;
  readonly onToggle: (nodeId: string) => void;
}

/**
 * Nút "…" của một dòng trong cây.
 *
 * Nó nằm NGOÀI thẻ liên kết chứ không lồng bên trong: một nút bấm nằm trong
 * `<a>` là HTML không hợp lệ, và mọi cú bấm vào nút cũng sẽ kích hoạt luôn liên
 * kết. Đặt tuyệt đối lên phần lề phải mà dòng đã chừa sẵn (`pr-8`) nên chữ
 * không bao giờ chui xuống dưới nút.
 */
const ROW_MENU_CLASS = cn(
  "absolute right-1 top-1/2 z-raised size-6 -translate-y-1/2 opacity-0 transition-opacity",
  "group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
);

export function TreeRow({ node, depth, href, isExpanded, isActive, onToggle }: TreeRowProps) {
  const container = isContainer(node);
  const { Icon, colorClass } = nodeVisual(node, container && isExpanded);
  const openPreview = useWorkspaceStore((state) => state.openPreview);

  const { dragProps, isDragging } = useDragSource(node);
  const { dropProps, isOver } = useDropTarget({ targetId: node.id, disabled: !container });

  const indent = depth * TREE_INDENT + 4;

  function handleToggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onToggle(node.id);
  }

  const content = (
    <>
      <span className="flex size-4 shrink-0 items-center justify-center" style={{ marginLeft: indent }}>
        {container ? (
          <button
            type="button"
            onClick={handleToggle}
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="rounded p-0.5 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-90")}
            />
          </button>
        ) : null}
      </span>

      <Icon className={cn("size-4 shrink-0", colorClass)} />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      <AccessBadge node={node} />
      {node.isFavorite && <Star className="size-3 shrink-0 fill-accent text-accent" />}
    </>
  );

  const className = cn(
    "group relative flex h-[30px] w-full items-center gap-1.5 rounded-md pr-8 text-lead outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-ring",
    isActive ? "bg-selection text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground",
    isOver && "bg-accent-soft ring-1 ring-accent",
    isDragging && "is-dragging",
  );

  return (
    <div className="group/row relative">
      {node.type === "file" ? (
        <button
          type="button"
          onClick={() => openPreview(node.id)}
          className={cn(className, "text-left")}
          {...dragProps}
        >
          {content}
        </button>
      ) : (
        <Link
          href={routableHref(href)}
          className={className}
          {...dragProps}
          {...dropProps}
          data-node-id={node.id}
        >
          {content}
        </Link>
      )}

      <DriveItemMenu node={node} href={href} className={ROW_MENU_CLASS} />
    </div>
  );
}
