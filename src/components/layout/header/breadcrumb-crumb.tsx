"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDropTarget } from "@/hooks/use-node-dnd";
import { cn } from "@/lib/utils";
import type { BreadcrumbItem } from "@/types";

interface BreadcrumbCrumbProps {
  readonly item: BreadcrumbItem;
  /** Workspace crumb resolves to the tree root rather than a node id. */
  readonly dropTargetId: string | null;
}

/**
 * A single crumb: navigates on click, offers sibling folders in a menu, and
 * accepts drops so items can be moved back up the tree.
 */
export function BreadcrumbCrumb({ item, dropTargetId }: BreadcrumbCrumbProps) {
  const { dropProps, isOver } = useDropTarget({ targetId: dropTargetId });

  const label = (
    <span
      className={cn(
        "max-w-[10rem] truncate rounded-md px-1.5 py-1 text-lead transition-colors",
        item.isCurrent ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
        isOver && "bg-accent-soft text-accent ring-1 ring-accent",
      )}
    >
      {item.label}
    </span>
  );

  return (
    <span className="flex min-w-0 items-center" {...dropProps}>
      {item.isCurrent ? (
        <span aria-current="page">{label}</span>
      ) : (
        <Link href={item.href} className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          {label}
        </Link>
      )}

      {item.siblings.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded p-0.5 text-faint-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/breadcrumb:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Sibling folders of ${item.label}`}
          >
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Go to</DropdownMenuLabel>
            {item.siblings.map((sibling) => (
              <DropdownMenuItem key={sibling.id} asChild>
                <Link href={sibling.href}>{sibling.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}
