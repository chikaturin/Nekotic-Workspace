"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly isCollapsed: boolean;
  readonly badgeCount?: number;
  /** Match nested routes, not just the exact path. */
  readonly matchNested?: boolean;
}

export function SidebarNavItem({
  href,
  label,
  icon: Icon,
  isCollapsed,
  badgeCount,
  matchNested = false,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = matchNested ? pathname.startsWith(href) : pathname === href;

  const link = (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-lead transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-selection text-foreground"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
        isCollapsed && "justify-center px-0",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className={cn("size-4 shrink-0", isActive && "text-accent")} />
      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge variant="count" className="metric px-1.5">
              {badgeCount}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (!isCollapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        {label}
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="metric text-accent">{badgeCount}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
