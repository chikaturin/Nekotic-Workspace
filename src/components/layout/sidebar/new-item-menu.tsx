"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateMenuItems } from "@/components/shared/create-menu-items";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/files/upload-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCapabilities } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

interface NewItemMenuProps {
  readonly isCollapsed: boolean;
  /** Container that receives the new item — the folder currently open. */
  readonly targetId: string | null;
  readonly targetName: string;
}

/**
 * Primary create action. The list of things it can create lives in
 * `CreateMenuItems`, shared with the Drive toolbar so the two can never offer
 * different sets.
 */
export function NewItemMenu({ isCollapsed, targetId, targetName }: NewItemMenuProps) {
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const capabilities = useCapabilities();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
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
          />
        </DropdownMenuContent>
      </DropdownMenu>

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
