"use client";

import {
  ArrowDownUp,
  Check,
  FilePlus2,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Star,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateMenuItems } from "@/components/shared/create-menu-items";
import { DriveItemMenu } from "@/components/drive/drive-item-menu";
import {
  CreateNameDialog,
  type PendingCreate,
} from "@/components/shared/create-name-dialog";
import { UploadDialog } from "@/components/files/upload-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCapabilities } from "@/hooks/use-permissions";
import { findNodeById, hrefForNode } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { SortKey, ViewMode } from "@/types";

const SORT_OPTIONS: readonly { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "updatedAt", label: "Last modified" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

interface ViewModeOption {
  readonly value: ViewMode;
  readonly icon: LucideIcon;
  readonly label: string;
}

const VIEW_MODES: readonly ViewModeOption[] = [
  { value: "grid", icon: LayoutGrid, label: "Grid" },
  { value: "list", icon: List, label: "List" },
];

interface DriveToolbarProps {
  readonly title: string;
  readonly subtitle: string;
  readonly targetId: string | null;
  readonly filesHref: string;
}

export function DriveToolbar({ title, subtitle, targetId, filesHref }: DriveToolbarProps) {
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const [pending, setPending] = useState<PendingCreate | null>(null);

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
  const trashNodes = useWorkspaceStore((state) => state.trashNodes);
  const createFolder = useWorkspaceStore((state) => state.createFolder);

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-title font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="metric truncate text-body text-faint-foreground">{subtitle}</p>
      </div>

      {hasSelection ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-1.5 py-1">
          <span className="metric px-1 text-body text-accent">{selectedIds.length} selected</span>
          <IconButton
            variant="ghost"
            aria-label="Favorite selected"
            onClick={() => selectedIds.forEach(toggleFavorite)}
          >
            <Star />
          </IconButton>
          <IconButton
            variant="ghost"
            aria-label="Trash selected"
            onClick={() => trashNodes(selectedIds)}
          >
            <Trash2 />
          </IconButton>
          <IconButton variant="ghost" aria-label="Clear selection" onClick={clearSelection}>
            <X />
          </IconButton>
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

        <IconButton
          size="icon"
          variant="outline"
          aria-label="Manage files"
          tooltip="Open file manager"
          asChild
        >
          <Link href={filesHref}>
            <HardDrive />
          </Link>
        </IconButton>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <IconButton size="icon" variant="outline" aria-label="Create here">
                  <FilePlus2 />
                </IconButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Create here</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" className="w-60">
            <CreateMenuItems
              targetId={targetId}
              targetName={title}
              includeFolder={false}
              onAskName={setPending}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <IconButton
          size="icon"
          variant="outline"
          aria-label="New folder"
          tooltip="New folder here"
          onClick={() => void createFolder(targetId, "Untitled folder")}
        >
          <FolderPlus />
        </IconButton>

        <Button size="sm" variant="default" className="gap-1.5" onClick={() => setUploaderOpen(true)}>
          <Upload />
          <span className="hidden sm:inline">Upload</span>
        </Button>

        {targetNode && (
          <DriveItemMenu
            node={targetNode}
            href={hrefForNode(tree, targetNode.id)}
            trigger="toolbar"
          />
        )}

        <CreateNameDialog pending={pending} onClose={() => setPending(null)} />

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

function isViewMode(value: string): value is ViewMode {
  return VIEW_MODES.some((option) => option.value === value);
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <ToggleGroup
      aria-label="View mode"
      value={mode}
      onValueChange={(next) => {
        if (isViewMode(next)) onChange(next);
      }}
    >
      {VIEW_MODES.map(({ value, icon: Icon, label }) => (
        <ToggleGroupItem key={value} value={value} aria-label={`${label} view`}>
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
