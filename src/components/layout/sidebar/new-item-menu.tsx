"use client";

import { FilePlus2, FolderPlus, KeyRound, Plus, SlidersHorizontal, SquareKanban, Upload } from "lucide-react";
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
import { BOARD_TEMPLATES } from "@/lib/board-templates";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

interface NewItemMenuProps {
  readonly isCollapsed: boolean;
  /** Container that receives the new item — the folder currently open. */
  readonly targetId: string | null;
  readonly targetName: string;
}

/**
 * Primary create action.
 *
 * Four content types, and no more: Folder, Page, Board, and the two documents
 * that genuinely need their own editor — Config and Secret. There is no "new
 * .txt", "new .md", "new .csv" or "new .xlsx", because a Page already holds
 * headings, checklists, code, tables, images, attachments and embedded boards.
 * Creating a second, weaker way to write a paragraph was never the point.
 *
 * Uploading files is untouched, and so are attachments: a file that arrives by
 * upload is still a file, and a file attached to a record is still an
 * attachment. What is gone is inventing a standalone file just to type in it.
 */
export function NewItemMenu({ isCollapsed, targetId, targetName }: NewItemMenuProps) {
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const { createDocument, isCreating } = useCreateDocument();
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
