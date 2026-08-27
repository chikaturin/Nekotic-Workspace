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
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";
import { useAccessSync } from "@/hooks/use-access-sync";
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
  // Access can be taken away while somebody is standing in what it opened.
  useAccessSync();
  useHotkey("mod+k", () => setSearchOpen(true), { enableInInputs: true });
  useHotkey("mod+b", toggleSidebar);

  return (
    <TooltipProvider>
      {/*
        `overflow-clip`, not `overflow-hidden`.
        Hidden still makes a scroll container — one that clips its scrollbar
        away. So anything that scrolls a box programmatically, a focus landing
        on a control that is out of view above all, could shove the entire
        frame up and out of sight with nothing left to scroll it back. Clip
        has no scrollport at all, so the frame cannot move.
      */}
      <div className="flex h-svh w-full overflow-clip bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <RolePreviewBanner />
          {/* Membership is settled before anything inside a workspace mounts. */}
          <main className="min-h-0 flex-1 overflow-clip">
            <WorkspaceGuard>{children}</WorkspaceGuard>
          </main>
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
