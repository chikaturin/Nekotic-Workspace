"use client";

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { VIEW_TYPE_LABELS, viewVisual } from "@/lib/board-visuals";
import { useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import type { BoardViewType, PermissionResolver, SavedView } from "@/types";

const VIEW_TYPES: readonly BoardViewType[] = ["table", "kanban", "calendar", "gantt"];

const VIEW_MIME = "application/x-nekotic-view";

export function ViewTabs({ model, can }: { model: BoardViewModel; can: PermissionResolver }) {
  const { board, view } = model;
  const canManage = can("board.view.manage");
  const setActiveView = useBoardStore((state) => state.setActiveView);
  const createView = useBoardStore((state) => state.createView);
  const moveViewTo = useBoardStore((state) => state.moveViewTo);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>, toIndex: number) {
    const viewId = event.dataTransfer.getData(VIEW_MIME);
    setDragOverId(null);
    if (!viewId) return;

    event.preventDefault();
    void moveViewTo(viewId, toIndex);
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3">
      <div role="toolbar" aria-label="Saved views" className="flex shrink-0 items-center gap-1">
        {board?.views.map((saved, index) => (
          <ViewTab
            key={saved.id}
            view={saved}
            index={index}
            count={board.views.length}
            isActive={saved.id === view?.id}
            isRenaming={renamingId === saved.id}
            isDragOver={dragOverId === saved.id}
            canManage={canManage}
            onSelect={() => setActiveView(saved.id)}
            onRenameStart={() => setRenamingId(saved.id)}
            onRenameEnd={() => setRenamingId(null)}
            onDragStateChange={setDragOverId}
            onDrop={handleDrop}
            onMove={(toIndex) => void moveViewTo(saved.id, toIndex)}
          />
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="New view"
            disabled={!canManage}
            className="shrink-0"
          >
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>New view</DropdownMenuLabel>
          {VIEW_TYPES.map((type) => {
            const visual = viewVisual(type);

            return (
              <DropdownMenuItem
                key={type}
                onSelect={() => void createView(VIEW_TYPE_LABELS[type], type)}
              >
                <visual.Icon />
                {VIEW_TYPE_LABELS[type]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ViewTabProps {
  readonly view: SavedView;
  readonly index: number;
  readonly count: number;
  readonly isActive: boolean;
  readonly isRenaming: boolean;
  readonly isDragOver: boolean;
  readonly canManage: boolean;
  readonly onSelect: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameEnd: () => void;
  readonly onDragStateChange: (viewId: string | null) => void;
  readonly onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
  readonly onMove: (toIndex: number) => void;
}

function ViewTab({
  view,
  index,
  count,
  isActive,
  isRenaming,
  isDragOver,
  canManage,
  onSelect,
  onRenameStart,
  onRenameEnd,
  onDragStateChange,
  onDrop,
  onMove,
}: ViewTabProps) {
  const renameView = useBoardStore((state) => state.renameView);
  const duplicateView = useBoardStore((state) => state.duplicateView);
  const deleteView = useBoardStore((state) => state.deleteView);
  const setViewType = useBoardStore((state) => state.setViewType);
  const [draft, setDraft] = useState(view.name);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const visual = viewVisual(view.type);

  const summary = [
    view.filters.length > 0 && `${view.filters.length} filter`,
    view.sorts.length > 0 && `${view.sorts.length} sort`,
    view.groupByColumnId && "grouped",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      draggable={canManage && !isRenaming}
      onDragStart={(event) => {
        if (isRenaming) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(VIEW_MIME, view.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(VIEW_MIME)) return;
        event.preventDefault();
        onDragStateChange(view.id);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        onDragStateChange(null);
      }}
      onDragEnd={() => onDragStateChange(null)}
      onDrop={(event) => onDrop(event, index)}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-t-md border-b-2 px-2 py-1.5 transition-colors",
        isActive ? "border-accent" : "border-transparent hover:bg-hover",
        canManage && !isRenaming && "cursor-grab active:cursor-grabbing",
        isDragOver && "bg-accent-soft",
      )}
    >
      <visual.Icon
        className={cn("size-3.5 shrink-0", isActive ? "text-accent" : "text-faint-foreground")}
      />

      {isRenaming ? (
        <Input
          size="xs"
          value={draft}
          autoFocus
          aria-label="View name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft.trim()) void renameView(view.id, draft.trim());
            onRenameEnd();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(view.name);
              onRenameEnd();
            }
          }}
          className="w-28 text-ui"
        />
      ) : (
        <button
          type="button"
          aria-current={isActive ? "page" : undefined}
          onClick={onSelect}
          onDoubleClick={() => canManage && onRenameStart()}
          className={cn(
            "flex items-baseline gap-1.5 text-ui",
            isActive ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {view.name}
          <span className="metric text-micro text-faint-foreground">
            {summary || VIEW_TYPE_LABELS[view.type]}
          </span>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            variant="ghost"
            aria-label={`${view.name} view options`}
            className="size-4 rounded text-faint-foreground [&_svg]:size-3"
          >
            <MoreHorizontal />
          </IconButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>{view.name}</DropdownMenuLabel>

          <DropdownMenuItem disabled={!canManage} onSelect={onRenameStart}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canManage} onSelect={() => void duplicateView(view.id)}>
            <Copy />
            Duplicate view
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!canManage}>
              <visual.Icon />
              View type
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {VIEW_TYPES.map((type) => {
                const option = viewVisual(type);

                return (
                  <DropdownMenuItem
                    key={type}
                    disabled={type === view.type}
                    onSelect={() => {
                      useBoardStore.getState().setActiveView(view.id);
                      void setViewType(type);
                    }}
                  >
                    <option.Icon />
                    {VIEW_TYPE_LABELS[type]}
                    {type === view.type && (
                      <span className="ml-auto text-micro text-faint-foreground">current</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={!canManage || index === 0} onSelect={() => onMove(index - 1)}>
            <ChevronLeft />
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canManage || index === count - 1}
            onSelect={() => onMove(index + 1)}
          >
            <ChevronRight />
            Move right
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="danger"
            disabled={!canManage}
            onSelect={() => setIsConfirmingDelete(true)}
          >
            <Trash2 />
            Delete view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title={`Delete the “${view.name}” view?`}
        description="Everyone on this board loses this view, with its filters, sorting and grouping. The records themselves are not affected."
        confirmLabel="Delete view"
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          setIsConfirmingDelete(false);
          void deleteView(view.id);
        }}
      />
    </div>
  );
}
