"use client";

import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { VIEW_TYPE_LABELS, viewVisual } from "@/lib/board-visuals";
import { useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import type { BoardViewType, PermissionResolver, SavedView } from "@/types";

const VIEW_TYPES: readonly BoardViewType[] = ["table", "kanban", "calendar", "timeline"];

/**
 * Saved views as tabs.
 *
 * Switching a tab changes which configuration the shared query runs — it never
 * loads or copies a record. That is the whole point of keeping views separate
 * from the board.
 */
/**
 * Creating, renaming and deleting a saved view changes what the whole team
 * sees, so it takes `board.view.manage`. Reading a board through one — the
 * filter, sort and group controls below the tabs — takes nothing.
 */
export function ViewTabs({ model, can }: { model: BoardViewModel; can: PermissionResolver }) {
  const { board, view } = model;
  const canManage = can("board.view.manage");
  const setActiveView = useBoardStore((state) => state.setActiveView);
  const createView = useBoardStore((state) => state.createView);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3">
      {board?.views.map((saved) => (
        <ViewTab
          key={saved.id}
          view={saved}
          isActive={saved.id === view?.id}
          isRenaming={renamingId === saved.id}
          canManage={canManage}
          onSelect={() => setActiveView(saved.id)}
          onRenameStart={() => setRenamingId(saved.id)}
          onRenameEnd={() => setRenamingId(null)}
        />
      ))}

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
  readonly isActive: boolean;
  readonly isRenaming: boolean;
  readonly canManage: boolean;
  readonly onSelect: () => void;
  readonly onRenameStart: () => void;
  readonly onRenameEnd: () => void;
}

function ViewTab({
  view,
  isActive,
  isRenaming,
  canManage,
  onSelect,
  onRenameStart,
  onRenameEnd,
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
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-t-md border-b-2 px-2 py-1.5 transition-colors",
        isActive ? "border-accent" : "border-transparent hover:bg-hover",
      )}
    >
      <visual.Icon
        className={cn("size-3.5 shrink-0", isActive ? "text-accent" : "text-faint-foreground")}
      />

      {isRenaming ? (
        <Input
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
          className="h-6 w-28 text-[12px]"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => canManage && onRenameStart()}
          className={cn(
            "flex items-baseline gap-1.5 text-[12px]",
            isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {view.name}
          <span className="metric text-[10px] text-faint-foreground">
            {summary || VIEW_TYPE_LABELS[view.type]}
          </span>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${view.name} view options`}
            className="flex size-4 items-center justify-center rounded text-faint-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-3" />
          </button>
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
                      // Selecting first means the type change lands on this view,
                      // whichever tab was active when the menu opened.
                      useBoardStore.getState().setActiveView(view.id);
                      void setViewType(type);
                    }}
                  >
                    <option.Icon />
                    {VIEW_TYPE_LABELS[type]}
                    {type === view.type && (
                      <span className="ml-auto text-[10px] text-faint-foreground">current</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

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

      {/* A saved view is shared: deleting one takes it away from the team, not
          just from this tab. The records themselves are untouched. */}
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
