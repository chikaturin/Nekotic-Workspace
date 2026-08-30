"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateMenuItems } from "@/components/shared/create-menu-items";
import {
  CreateNameDialog,
  type PendingCreate,
} from "@/components/shared/create-name-dialog";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/files/upload-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCapabilities } from "@/hooks/use-permissions";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

interface NewItemMenuProps {
  readonly isCollapsed: boolean;
  readonly targetId: string | null;
  readonly targetName: string;
}

export function NewItemMenu({ isCollapsed, targetId, targetName }: NewItemMenuProps) {
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const [pending, setPending] = useState<PendingCreate | null>(null);
  const capabilities = useCapabilities();
  const hasWorkspace = useWorkspaceStore((state) => state.activeWorkspaceId !== "");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            disabled={!hasWorkspace}
            className={cn("w-full justify-start gap-2", isCollapsed && "justify-center px-0")}
            aria-label="Create new item"
          >
            <Plus />
            {!isCollapsed && <span>New</span>}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <CreateMenuItems
            targetId={targetId}
            targetName={targetName}
            onUpload={() => setUploaderOpen(true)}
            onAskName={setPending}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateNameDialog pending={pending} onClose={() => setPending(null)} />

      <UploadDialog
        open={isUploaderOpen}
        onOpenChange={setUploaderOpen}
        folderId={targetId}
        folderName={targetName}
        canUpload={capabilities.upload}
      />
    </>
  );
}
