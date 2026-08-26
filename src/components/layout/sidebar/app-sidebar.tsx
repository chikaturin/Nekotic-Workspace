"use client";

import { motion } from "framer-motion";
import {
  Archive,
  Bell,
  Briefcase,
  Clock,
  FolderPlus,
  HardDrive,
  LayoutDashboard,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Star,
  Sun,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { NewItemMenu } from "@/components/layout/sidebar/new-item-menu";
import { PinnedPages } from "@/components/layout/sidebar/pinned-pages";
import { SidebarNavItem } from "@/components/layout/sidebar/sidebar-nav-item";
import { SidebarSection } from "@/components/layout/sidebar/sidebar-section";
import { StorageMeter } from "@/components/layout/sidebar/storage-meter";
import { WorkspaceSwitcher } from "@/components/layout/sidebar/workspace-switcher";
import { TreePanel } from "@/components/tree/tree-panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FILES_ROOT_PATH,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  SMART_VIEWS,
} from "@/config/app";
import { useCurrentTarget } from "@/hooks/use-current-target";
import { usePermissions } from "@/hooks/use-permissions";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { selectUnreadCount, useNotificationStore } from "@/store/notification-store";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { SmartViewId } from "@/types";

const SMART_VIEW_ICONS: Record<SmartViewId, LucideIcon> = {
  "my-work": Briefcase,
  favorites: Star,
  recent: Clock,
  notifications: Bell,
  archive: Archive,
  trash: Trash2,
};

/** Collapsible primary rail: workspace, create, project tree, smart views. */
export function AppSidebar() {
  const isCollapsed = useWorkspaceStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);
  const { targetId, targetName } = useCurrentTarget();
  const { theme, toggleTheme } = useTheme();
  const unreadCount = useNotificationStore(selectUnreadCount);
  const can = usePermissions();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.7 }}
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-border bg-surface"
      aria-label="Workspace navigation"
    >
      <div className={cn("flex h-14 items-center px-2", isCollapsed && "justify-center px-1")}>
        <WorkspaceSwitcher isCollapsed={isCollapsed} />
      </div>

      <div className={cn("px-3 pb-3", isCollapsed && "px-2")}>
        <NewItemMenu isCollapsed={isCollapsed} targetId={targetId} targetName={targetName} />
      </div>

      <div
        className={cn(
          "no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3",
          isCollapsed && "items-center px-1.5",
        )}
      >
        <SidebarSection title="Pinned" isCollapsed={isCollapsed}>
          <PinnedPages isCollapsed={isCollapsed} />
        </SidebarSection>

        <SidebarSection
          title="Projects"
          isCollapsed={isCollapsed}
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => createFolder(null, "Untitled project folder")}
                  aria-label="New top-level folder"
                >
                  <FolderPlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New top-level folder</TooltipContent>
            </Tooltip>
          }
        >
          {isCollapsed ? (
            <SidebarNavItem
              href="/drive"
              label="Drive"
              icon={FolderPlus}
              isCollapsed
              matchNested
            />
          ) : (
            <TreePanel nodes={tree} />
          )}
        </SidebarSection>

        <SidebarSection title="Workspace" isCollapsed={isCollapsed}>
          <SidebarNavItem
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            isCollapsed={isCollapsed}
          />
          <SidebarNavItem
            href={FILES_ROOT_PATH}
            label="Files"
            icon={HardDrive}
            isCollapsed={isCollapsed}
            matchNested
          />
          {SMART_VIEWS.map((view) => (
            <SidebarNavItem
              key={view.id}
              href={view.href}
              label={view.label}
              icon={SMART_VIEW_ICONS[view.id]}
              isCollapsed={isCollapsed}
              badgeCount={view.id === "notifications" ? unreadCount : undefined}
            />
          ))}

          {/* Hidden rather than disabled: a rail entry that always refuses is
              an invitation to ask why. The page checks the same key again. */}
          {can("workspace.audit.view") && (
            <SidebarNavItem
              href="/audit"
              label="Audit log"
              icon={ScrollText}
              isCollapsed={isCollapsed}
            />
          )}
        </SidebarSection>
      </div>

      <div className={cn("border-t border-border p-2", isCollapsed && "px-1.5")}>
        <StorageMeter storage={workspace.storage} isCollapsed={isCollapsed} />

        <div className={cn("mt-1 flex items-center gap-1", isCollapsed && "flex-col")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Switch to {theme === "dark" ? "light" : "dark"} theme
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={toggleSidebar}
                className={cn(!isCollapsed && "ml-auto")}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand" : "Collapse"} sidebar
              <span className="metric ml-2 text-faint-foreground">Ctrl B</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.aside>
  );
}
