"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/header/app-header";
import { GlobalSearchDialog } from "@/components/search/global-search-dialog";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { RolePreviewBanner } from "@/components/permissions/role-preview-banner";
import { FeedbackToast } from "@/components/shared/feedback-toast";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { DrivePreviewDialog } from "@/components/drive/drive-preview-dialog";
import { UploadQueuePanel } from "@/components/files/upload-queue-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHotkey } from "@/hooks/use-hotkey";
import { useResponsiveSidebar } from "@/hooks/use-responsive-sidebar";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Application frame: collapsible rail, sticky path header, and the overlays
 * (search, preview, feedback) that any view can trigger.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const setSearchOpen = useWorkspaceStore((state) => state.setSearchOpen);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);

  useResponsiveSidebar();
  useHotkey("mod+k", () => setSearchOpen(true), { enableInInputs: true });
  useHotkey("mod+b", toggleSidebar);

  return (
    <TooltipProvider>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <RolePreviewBanner />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      <GlobalSearchDialog />
      <DrivePreviewDialog />
      <UploadQueuePanel />
      <RenameDialog />
      <FeedbackToast />
    </TooltipProvider>
  );
}
