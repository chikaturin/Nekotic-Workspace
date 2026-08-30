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
import type { PendingCreate } from "@/components/shared/create-name-dialog";
import { useCreateBoard } from "@/hooks/use-create-board";
import { useCreateDocument } from "@/hooks/use-create-document";
import { BOARD_TEMPLATES } from "@/lib/board-templates";
import { CONFIG_FORMATS, CONFIG_FORMAT_LABELS } from "@/lib/syntax";
import { useWorkspaceStore } from "@/store/workspace-store";

interface CreateMenuItemsProps {
  readonly targetId: string | null;
  readonly targetName: string;
  readonly includeFolder?: boolean;
  readonly onUpload?: () => void;
  /**
   * Hỏi tên trước khi tạo.
   *
   * Hộp thoại phải do THÀNH PHẦN CHA giữ: chọn một mục trong menu sẽ đóng menu,
   * và mọi thứ bên trong `DropdownMenuContent` bị gỡ theo — kể cả hộp thoại vừa
   * mở ra.
   */
  readonly onAskName: (pending: PendingCreate) => void;
}

export function CreateMenuItems({
  targetId,
  targetName,
  includeFolder = true,
  onUpload,
  onAskName,
}: CreateMenuItemsProps) {
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const { createDocument, isCreating } = useCreateDocument();
  const { createBoard, isCreating: isCreatingBoard } = useCreateBoard();

  return (
    <>
      <DropdownMenuLabel>Create in {targetName}</DropdownMenuLabel>

      <DropdownMenuItem
        disabled={isCreating}
        onSelect={() =>
          onAskName({
            title: "Trang mới",
            label: "Tên trang",
            suggestion: "Untitled",
            run: (name) => void createDocument(targetId, name),
          })
        }
      >
        <FilePlus2 />
        Page
        <DropdownMenuShortcut>P</DropdownMenuShortcut>
      </DropdownMenuItem>

      {includeFolder && (
        <DropdownMenuItem
          onSelect={() =>
            onAskName({
              title: "Thư mục mới",
              label: "Tên thư mục",
              suggestion: "Untitled folder",
              run: (name) => void createFolder(targetId, name),
            })
          }
        >
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
              onSelect={() =>
                onAskName({
                  title: `Board mới · ${template.name}`,
                  label: "Tên board",
                  suggestion: template.name,
                  run: (name) => void createBoard(targetId, template, name),
                })
              }
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
                onAskName({
                  title: `Config ${CONFIG_FORMAT_LABELS[format]} mới`,
                  label: "Tên tài liệu",
                  suggestion: `Untitled ${CONFIG_FORMAT_LABELS[format]} config`,
                  run: (name) => void createDocument(targetId, name, "config", format),
                })
              }
            >
              {CONFIG_FORMAT_LABELS[format]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem
        disabled={isCreating}
        onSelect={() =>
          onAskName({
            title: "Tài liệu secret mới",
            label: "Tên tài liệu",
            suggestion: "Untitled secrets",
            run: (name) => void createDocument(targetId, name, "secret"),
          })
        }
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
