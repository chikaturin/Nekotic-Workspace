"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { DriveItemMenu } from "@/components/drive/drive-item-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { routableHref } from "@/lib/exported-routes";
import { collectNodes, hrefForNode } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { nodeVisual } from "@/lib/node-visuals";
import type { DriveNode } from "@/types";

interface PinnedPagesProps {
  readonly isCollapsed: boolean;
}

const PIN_MENU_CLASS = cn(
  "absolute right-1 top-1/2 z-raised size-6 -translate-y-1/2 opacity-0 transition-opacity",
  "group-hover/pin:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
);

export function PinnedPages({ isCollapsed }: PinnedPagesProps) {
  const tree = useWorkspaceStore(selectTree);
  const pathname = usePathname();

  const pinned = useMemo(
    () =>
      collectNodes(
        tree,
        (node) => node.isPinned && !node.isTrashed && !node.isArchived,
      ) as readonly DriveNode[],
    [tree],
  );

  if (pinned.length === 0) return null;

  return (
    <>
      {pinned.map((page) => {
        const href = hrefForNode(tree, page.id);
        const routable = routableHref(href);
        const isActive = pathname === routable;

        const link = (
          <Link
            href={routable}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-lead outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-selection text-foreground"
                : "text-muted-foreground hover:bg-hover hover:text-foreground",
              isCollapsed ? "justify-center px-0" : "pr-8",
            )}
          >
            <PinnedIcon node={page} />
            {!isCollapsed && <span className="min-w-0 flex-1 truncate">{page.name}</span>}
          </Link>
        );

        if (isCollapsed) {
          return (
            <Tooltip key={page.id}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{page.name}</TooltipContent>
            </Tooltip>
          );
        }

        // Menu nằm ngoài liên kết — chỗ bỏ ghim mà trước đây danh sách này không
        // có, nên ghim xong rồi thì không gỡ ra được từ đây.
        return (
          <div key={page.id} className="group/pin relative">
            {link}
            <DriveItemMenu node={page} href={href} className={PIN_MENU_CLASS} />
          </div>
        );
      })}
    </>
  );
}

/**
 * Biểu tượng của mục đã ghim.
 *
 * Trang có emoji riêng của nó; bảng, thư mục và tệp thì lấy biểu tượng theo
 * loại — trước đây danh sách này chỉ chứa trang nên chỗ này in thẳng
 * `page.icon`, và mọi thứ khác sẽ hiện ra một ô trống.
 */
function PinnedIcon({ node }: { readonly node: DriveNode }) {
  if (node.type === "document" && node.icon) {
    return (
      <span aria-hidden className="text-lead leading-none">
        {node.icon}
      </span>
    );
  }

  const visual = nodeVisual(node);

  return <visual.Icon aria-hidden className={cn("size-4 shrink-0", visual.colorClass)} />;
}
