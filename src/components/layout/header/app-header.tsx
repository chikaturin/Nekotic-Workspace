"use client";

import { Bell, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { BreadcrumbNav } from "@/components/layout/header/breadcrumb-nav";
import { GlobalSearch } from "@/components/layout/header/global-search";
import { UserMenu } from "@/components/layout/header/user-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DRIVE_ROOT_PATH, FILES_ROOT_PATH, SMART_VIEWS } from "@/config/app";
import { useDriveLocation } from "@/hooks/use-drive-location";
import { useDriveSegments } from "@/hooks/use-current-target";
import { UNREAD_COUNT } from "@/mock/notifications";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { BreadcrumbTrail } from "@/types";

/** Path + search + identity. The breadcrumb tracks the drive tree live. */
export function AppHeader() {
  const pathname = usePathname();
  const segments = useDriveSegments();
  const { breadcrumbs } = useDriveLocation(segments);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const isCollapsed = useWorkspaceStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);

  const trail = useMemo<BreadcrumbTrail>(() => {
    if (pathname.startsWith(DRIVE_ROOT_PATH)) return breadcrumbs;

    // The file manager mirrors the drive path, so it reuses the same crumbs.
    if (pathname.startsWith(FILES_ROOT_PATH)) {
      return breadcrumbs.map((crumb, index) => ({
        ...crumb,
        href: `${FILES_ROOT_PATH}${crumb.href.slice(DRIVE_ROOT_PATH.length)}`,
        isCurrent: index === breadcrumbs.length - 1,
      }));
    }

    const view = SMART_VIEWS.find((candidate) => candidate.href === pathname);
    const root = {
      id: workspace.id,
      label: workspace.name,
      href: DRIVE_ROOT_PATH,
      kind: "workspace" as const,
      isCurrent: !view,
      siblings: [],
    };

    if (!view) return [root];
    return [
      root,
      {
        id: view.id,
        label: view.label,
        href: view.href,
        kind: "folder" as const,
        isCurrent: true,
        siblings: [],
      },
    ];
  }, [pathname, breadcrumbs, workspace]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-3 backdrop-blur-md">
      {isCollapsed && (
        <Button size="icon-sm" variant="ghost" onClick={toggleSidebar} aria-label="Expand sidebar">
          <PanelLeftOpen />
        </Button>
      )}

      <div className="min-w-0 flex-1">
        <BreadcrumbNav trail={trail} />
      </div>

      <div className="hidden w-full max-w-md flex-1 justify-center md:flex">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" asChild className="relative">
              <Link href="/notifications" aria-label={`Notifications (${UNREAD_COUNT} unread)`}>
                <Bell />
                {UNREAD_COUNT > 0 && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent ring-2 ring-surface" />
                )}
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{UNREAD_COUNT} unread notifications</TooltipContent>
        </Tooltip>

        <UserMenu />
      </div>
    </header>
  );
}
