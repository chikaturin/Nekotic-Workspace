"use client";

import { FilePlus2, FolderPlus, KeyRound, SlidersHorizontal, SquareKanban, Upload } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateBoard } from "@/hooks/use-create-board";
import { useCreateDocument } from "@/hooks/use-create-document";
import { BOARD_TEMPLATES } from "@/lib/board-templates";
import { CONFIG_FORMATS, CONFIG_FORMAT_LABELS } from "@/lib/syntax";
import { useWorkspaceStore } from "@/store/workspace-store";

interface CreateMenuItemsProps {
  /** Container that receives the new item — the folder currently open. */
  readonly targetId: string | null;
  readonly targetName: string;
  /** Omitted where the surface already has its own folder button beside it. */
  readonly includeFolder?: boolean;
  /** Given only where the menu is the surface's only way to upload. */
  readonly onUpload?: () => void;
}

/**
 * The create menu, once.
 *
 * Every surface that offers "new…" offers the same four content types —
 * Folder, Page, Board, and the two documents that need their own editor,
 * Config and Secret. Keeping the list here is what stops one entry point
 * quietly offering less than another, which is exactly how the Drive toolbar
 * ended up able to create nothing but a Page.
 *
 * There is still no "new .txt", "new .md", "new .csv" or "new .xlsx": a Page
 * already holds headings, checklists, code, tables, images, attachments and
 * embedded boards. Uploading files and attaching them to records are untouched.
 */
export function CreateMenuItems({
  targetId,
  targetName,
  includeFolder = true,
  onUpload,
}: CreateMenuItemsProps) {
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const { createDocument, isCreating } = useCreateDocument();
  const { createBoard, isCreating: isCreatingBoard } = useCreateBoard();

  return (
    <>
      <DropdownMenuLabel>Create in {targetName}</DropdownMenuLabel>

      <DropdownMenuItem disabled={isCreating} onSelect={() => void createDocument(targetId)}>
        <FilePlus2 />
        Page
        <DropdownMenuShortcut>P</DropdownMenuShortcut>
      </DropdownMenuItem>

      {includeFolder && (
        <DropdownMenuItem onSelect={() => createFolder(targetId, "Untitled folder")}>
          <FolderPlus />
          Folder
          <DropdownMenuShortcut>N</DropdownMenuShortcut>
        </DropdownMenuItem>
      )}

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
                <span className="truncate text-body text-faint-foreground">
                  {template.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      {/* The language is chosen here rather than in a dialog, for the same
          reason a board's template is: the app creates and then renames
          inline, and one modal on the path to one document would be the only
          one in the menu. The language is changeable in the header afterwards. */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={isCreating}>
          <SlidersHorizontal />
          Config document
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-80 w-48 overflow-y-auto">
          <DropdownMenuLabel>Language</DropdownMenuLabel>
          {CONFIG_FORMATS.map((format) => (
            <DropdownMenuItem
              key={format}
              disabled={isCreating}
              onSelect={() =>
                void createDocument(
                  targetId,
                  `Untitled ${CONFIG_FORMAT_LABELS[format]} config`,
                  "config",
                  format,
                )
              }
            >
              {CONFIG_FORMAT_LABELS[format]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem
        disabled={isCreating}
        onSelect={() => void createDocument(targetId, "Untitled secrets", "secret")}
      >
        <KeyRound />
        Secret document
      </DropdownMenuItem>

      {onUpload && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onUpload}>
            <Upload />
            Upload files
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
