"use client";

import { FilePlus2, FileType2, FolderPlus, KeyRound, Plus, SlidersHorizontal, SquareKanban, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/files/upload-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCapabilities } from "@/hooks/use-permissions";
import { useCreateBoard } from "@/hooks/use-create-board";
import { useCreateDocument } from "@/hooks/use-create-document";
import { useCreateFile } from "@/hooks/use-create-file";
import { BOARD_TEMPLATES } from "@/lib/board-templates";
import { FILE_TEMPLATES } from "@/lib/file-templates";
import { fileKindVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

interface NewItemMenuProps {
  readonly isCollapsed: boolean;
  /** Container that receives the new item — the folder currently open. */
  readonly targetId: string | null;
  readonly targetName: string;
}

/** Primary create action: folder, board or upload into the current location. */
export function NewItemMenu({ isCollapsed, targetId, targetName }: NewItemMenuProps) {
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const { createDocument, isCreating } = useCreateDocument();
  const { createFile, isCreating: isCreatingFile } = useCreateFile();
  const { createBoard, isCreating: isCreatingBoard } = useCreateBoard();
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
          <DropdownMenuLabel>Create in {targetName}</DropdownMenuLabel>
          <DropdownMenuItem disabled={isCreating} onSelect={() => void createDocument(targetId)}>
            <FilePlus2 />
            Page
            <DropdownMenuShortcut>P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => createFolder(targetId, "Untitled folder")}>
            <FolderPlus />
            Folder
            <DropdownMenuShortcut>N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isCreating}
            onSelect={() => void createDocument(targetId, "Untitled config", "config")}
          >
            <SlidersHorizontal />
            Config document
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isCreating}
            onSelect={() => void createDocument(targetId, "Untitled secrets", "secret")}
          >
            <KeyRound />
            Secret document
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isCreatingBoard}>
              <SquareKanban />
              Board
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              <DropdownMenuLabel>From a template</DropdownMenuLabel>
              {BOARD_TEMPLATES.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  disabled={isCreatingBoard}
                  onSelect={() => createBoard(targetId, template)}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5">
                      {template.name}
                      <DropdownMenuShortcut>{template.rowIdPrefix}-001</DropdownMenuShortcut>
                    </span>
                    <span className="truncate text-[11px] text-faint-foreground">
                      {template.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isCreatingFile}>
              <FileType2 />
              File
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60">
              <DropdownMenuLabel>Blank file</DropdownMenuLabel>
              {FILE_TEMPLATES.map((template) => {
                const visual = fileKindVisual(template.kind);

                return (
                  <DropdownMenuItem
                    key={template.id}
                    disabled={isCreatingFile}
                    onSelect={() => void createFile(targetId, template)}
                  >
                    <visual.Icon className={visual.colorClass} />
                    <span className="flex-1">{template.label}</span>
                    <DropdownMenuShortcut>.{template.extension}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setUploaderOpen(true)}>
            <Upload />
            Upload files
          </DropdownMenuItem>
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
