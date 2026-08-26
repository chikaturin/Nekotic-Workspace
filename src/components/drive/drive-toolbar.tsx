"use client";

import {
  ArrowDownUp,
  Check,
  FilePlus2,
  FileText,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UploadDialog } from "@/components/files/upload-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useCreateDocument } from "@/hooks/use-create-document";
import { useCreateFile } from "@/hooks/use-create-file";
import { FILE_TEMPLATES } from "@/lib/file-templates";
import { fileKindVisual } from "@/lib/node-visuals";
import { findNodeById } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { SortKey, ViewMode } from "@/types";

const SORT_OPTIONS: readonly { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "updatedAt", label: "Last modified" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

interface DriveToolbarProps {
  readonly title: string;
  readonly subtitle: string;
  readonly targetId: string | null;
  /** Route of the file-manager view for the folder on screen. */
  readonly filesHref: string;
}

/** View controls, sorting, create/upload and the bulk-selection bar. */
export function DriveToolbar({ title, subtitle, targetId, filesHref }: DriveToolbarProps) {
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const { createDocument, isCreating } = useCreateDocument();
  const { createFile, isCreating: isCreatingFile } = useCreateFile();

  const tree = useWorkspaceStore(selectTree);
  const targetNode = useMemo(
    () => (targetId ? findNodeById(tree, targetId) : null),
    [tree, targetId],
  );
  const capabilities = useCapabilities(targetNode);

  const viewMode = useWorkspaceStore((state) => state.viewMode);
  const setViewMode = useWorkspaceStore((state) => state.setViewMode);
  const sort = useWorkspaceStore((state) => state.sort);
  const setSort = useWorkspaceStore((state) => state.setSort);
  const selectedIds = useWorkspaceStore((state) => state.selectedIds);
  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite);
  const trashNode = useWorkspaceStore((state) => state.trashNode);
  const createFolder = useWorkspaceStore((state) => state.createFolder);

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="metric truncate text-[11px] text-faint-foreground">{subtitle}</p>
      </div>

      {hasSelection ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-1.5 py-1">
          <span className="metric px-1 text-[11px] text-accent">{selectedIds.length} selected</span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Favorite selected"
            onClick={() => selectedIds.forEach(toggleFavorite)}
          >
            <Star />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Trash selected"
            onClick={() => {
              selectedIds.forEach(trashNode);
              clearSelection();
            }}
          >
            <Trash2 />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={clearSelection}>
            <X />
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowDownUp />
              <span className="hidden sm:inline">
                {SORT_OPTIONS.find((option) => option.key === sort.key)?.label ?? "Sort"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.key}
                onSelect={() => setSort({ key: option.key, direction: sort.direction })}
              >
                {option.label}
                {sort.key === option.key && <Check className="ml-auto size-4 text-accent" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                setSort({ key: sort.key, direction: sort.direction === "asc" ? "desc" : "asc" })
              }
            >
              {sort.direction === "asc" ? "Ascending" : "Descending"}
              <ArrowDownUp className="ml-auto size-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ViewToggle mode={viewMode} onChange={setViewMode} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Manage files" asChild>
              <Link href={filesHref}>
                <HardDrive />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open file manager</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="New page or file"
                  disabled={isCreating || isCreatingFile}
                >
                  <FilePlus2 />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>New page or file here</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Create in {title}</DropdownMenuLabel>
            <DropdownMenuItem disabled={isCreating} onSelect={() => void createDocument(targetId)}>
              <FileText />
              Page
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              aria-label="New folder"
              onClick={() => createFolder(targetId, "Untitled folder")}
            >
              <FolderPlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New folder here</TooltipContent>
        </Tooltip>

        <Button size="sm" variant="default" className="gap-1.5" onClick={() => setUploaderOpen(true)}>
          <Upload />
          <span className="hidden sm:inline">Upload</span>
        </Button>

        <UploadDialog
          open={isUploaderOpen}
          onOpenChange={setUploaderOpen}
          folderId={targetId}
          folderName={title}
          canUpload={capabilities.upload}
        />
      </div>
    </div>
  );
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="flex items-center rounded-md border border-border bg-surface p-0.5"
    >
      {(
        [
          { value: "grid", icon: LayoutGrid, label: "Grid" },
          { value: "list", icon: List, label: "List" },
        ] as const
      ).map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={`${label} view`}
          onClick={() => onChange(value)}
          className={cn(
            "flex size-6 items-center justify-center rounded transition-colors",
            mode === value
              ? "bg-accent-soft text-accent"
              : "text-faint-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
