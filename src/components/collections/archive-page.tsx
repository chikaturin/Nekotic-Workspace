"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/drive/empty-state";
import { EntityRow } from "@/components/collections/entity-row";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import { isArchivedNode } from "@/lib/archive";
import { nodeRef } from "@/lib/entity-ref";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { collectNodes, findNodeById, pathLabel } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode } from "@/types";

/**
 * Archive (SY-ARC-37).
 *
 * Everything frozen out of the active workspace, whatever its kind. Items stay
 * openable — that is the point of archiving rather than deleting — and each
 * one can be restored from here without going to it first.
 */
export function ArchivePage() {
  const tree = useWorkspaceStore(selectTree);

  /**
   * Only the outermost archived node is listed: everything below it is frozen
   * by inheritance and cannot be restored on its own, so listing the children
   * would offer a button that does nothing.
   */
  const nodes = useMemo(() => collectNodes(tree, isArchivedNode), [tree]);
  const roots = useMemo(() => topmost(tree, nodes), [tree, nodes]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Archive className="size-4 text-accent" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title font-semibold tracking-tight text-foreground">
            Archive
          </h1>
          <p className="metric truncate text-body text-faint-foreground">
            Read-only, still searchable · {formatCount(roots.length, "item")}
          </p>
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        {roots.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nothing is archived"
            description="Archiving freezes a project, folder, board or page: it stays readable and searchable, but stops accepting edits."
            action={{ label: "Go to Drive", href: "/drive" }}
          />
        ) : (
          <ul className="space-y-1.5">
            {roots.map((node) => (
              <li key={node.id}>
                <ArchiveRow node={node} path={pathLabel(tree, node.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * One archived item. It is its own component because Restore is permission-
 * gated and permissions are resolved per node — the answer for the project you
 * own is not the answer for the one you were added to.
 */
function ArchiveRow({ node, path }: { node: DriveNode; path: string }) {
  const setNodeArchived = useWorkspaceStore((state) => state.setNodeArchived);
  const can = usePermissions(node);
  const openEntity = useOpenEntity();

  const visual = nodeVisual(node);
  const canRestore = can("node.archive");

  return (
    <EntityRow
      icon={visual.Icon}
      iconClassName={visual.colorClass}
      title={node.name}
      subtitle={`${visual.label} · ${path} · archived ${formatRelativeTime(node.updatedAt)}`}
      onOpen={() => openEntity(nodeRef(node))}
      actions={
        canRestore ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setNodeArchived(node.id, false)}
          >
            <ArchiveRestore />
            Restore
          </Button>
        ) : (
          <span className="metric px-1 text-micro text-faint-foreground">read only</span>
        )
      }
    />
  );
}

/** Drop archived nodes that sit inside another archived node. */
function topmost(tree: readonly DriveNode[], nodes: readonly DriveNode[]): readonly DriveNode[] {
  const archivedIds = new Set(nodes.map((node) => node.id));

  return nodes.filter((node) => {
    let parentId = node.parentId;

    while (parentId) {
      if (archivedIds.has(parentId)) return false;
      parentId = findNodeById(tree, parentId)?.parentId ?? null;
    }

    return true;
  });
}
