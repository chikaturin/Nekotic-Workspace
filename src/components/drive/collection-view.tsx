"use client";

import { Archive, Bell, Briefcase, Clock, Star, Trash2, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { DriveGrid } from "@/components/drive/drive-grid";
import { DriveList } from "@/components/drive/drive-list";
import { EmptyState } from "@/components/drive/empty-state";
import { MOCK_NOW, SMART_VIEWS } from "@/config/app";
import { formatCount } from "@/lib/format";
import { collectNodes, hrefForNode, sortNodes } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isDocument, type DriveNode, type SmartViewId } from "@/types";

/** Archived pages are hidden everywhere except the Archive view. */
const isArchived = (node: DriveNode): boolean => isDocument(node) && node.isArchived;

const RECENT_WINDOW_MS = 7 * 24 * 3_600_000;

const VIEW_ICONS: Record<SmartViewId, LucideIcon> = {
  "my-work": Briefcase,
  favorites: Star,
  recent: Clock,
  notifications: Bell,
  archive: Archive,
  trash: Trash2,
};

/** Predicate per smart view — the only thing that varies between them. */
function predicateFor(viewId: SmartViewId): (node: DriveNode) => boolean {
  switch (viewId) {
    case "favorites":
      return (node) => node.isFavorite && !node.isTrashed && !isArchived(node);
    case "archive":
      return (node) => isArchived(node) && !node.isTrashed;
    case "trash":
      return (node) => node.isTrashed;
    case "my-work":
      return (node) => node.owner.id === CURRENT_USER.id && !node.isTrashed && !isArchived(node);
    case "recent":
      return (node) =>
        !node.isTrashed &&
        !isArchived(node) &&
        new Date(MOCK_NOW).getTime() - new Date(node.updatedAt).getTime() <= RECENT_WINDOW_MS;
    default:
      return () => false;
  }
}

/**
 * Flat, cross-tree listing shared by Favorites / Recent / My Work / Trash.
 * Reuses the drive layouts so interaction stays identical everywhere.
 */
export function CollectionView({ viewId }: { viewId: SmartViewId }) {
  const tree = useWorkspaceStore(selectTree);
  const sort = useWorkspaceStore((state) => state.sort);
  const viewMode = useWorkspaceStore((state) => state.viewMode);
  const selectedIds = useWorkspaceStore((state) => state.selectedIds);
  const toggleSelection = useWorkspaceStore((state) => state.toggleSelection);

  const view = SMART_VIEWS.find((candidate) => candidate.id === viewId);
  const nodes = useMemo(
    () => sortNodes(collectNodes(tree, predicateFor(viewId)), sort),
    [tree, viewId, sort],
  );

  const Icon = VIEW_ICONS[viewId];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Icon className="size-4 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
            {view?.label ?? "Collection"}
          </h1>
          <p className="metric truncate text-[11px] text-faint-foreground">
            {view?.description} · {formatCount(nodes.length, "item")}
          </p>
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        {nodes.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={`Nothing in ${view?.label ?? "this view"}`}
            description={view?.description ?? ""}
            action={{ label: "Go to Drive", href: "/drive" }}
          />
        ) : viewMode === "grid" ? (
          <DriveGrid
            nodes={nodes}
            resolveHref={(node) => hrefForNode(tree, node.id)}
            selectedIds={selectedIds}
            onSelect={toggleSelection}
            revealKey={viewId}
          />
        ) : (
          <DriveList
            nodes={nodes}
            resolveHref={(node) => hrefForNode(tree, node.id)}
            selectedIds={selectedIds}
            onSelect={toggleSelection}
            revealKey={viewId}
          />
        )}
      </div>
    </div>
  );
}
