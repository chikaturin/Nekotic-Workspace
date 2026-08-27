"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { routableHref } from "@/lib/exported-routes";
import { collectNodes, hrefForNode } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isDocument, type DocumentNode } from "@/types";

interface PinnedPagesProps {
  readonly isCollapsed: boolean;
}

/** Pages the user pinned, straight under the workspace switcher. */
export function PinnedPages({ isCollapsed }: PinnedPagesProps) {
  const tree = useWorkspaceStore(selectTree);
  const pathname = usePathname();

  const pinned = useMemo(
    () =>
      collectNodes(
        tree,
        (node) => isDocument(node) && node.isPinned && !node.isTrashed && !node.isArchived,
      ) as readonly DocumentNode[],
    [tree],
  );

  if (pinned.length === 0) return null;

  return (
    <>
      {pinned.map((page) => {
        const href = routableHref(hrefForNode(tree, page.id));
        const isActive = pathname === href;

        const link = (
          <Link
            key={page.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-selection text-foreground"
                : "text-muted-foreground hover:bg-hover hover:text-foreground",
              isCollapsed && "justify-center px-0",
            )}
          >
            <span aria-hidden className="text-sm leading-none">
              {page.icon}
            </span>
            {!isCollapsed && <span className="min-w-0 flex-1 truncate">{page.name}</span>}
          </Link>
        );

        if (!isCollapsed) return link;

        return (
          <Tooltip key={page.id}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{page.name}</TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
