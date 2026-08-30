"use client";

import { Star } from "lucide-react";
import { useMemo } from "react";
import { EntityRow } from "@/components/collections/entity-row";
import { EmptyState } from "@/components/drive/empty-state";
import { FavoriteButton } from "@/components/shared/favorite-star";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import { nodeRef } from "@/lib/entity-ref";
import { formatCount } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { collectNodes, pathLabel } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isDocument, type DriveNode, type DriveNodeType } from "@/types";

const GROUP_ORDER: readonly DriveNodeType[] = ["project", "folder", "board", "document", "file"];

const GROUP_LABELS: Readonly<Record<DriveNodeType, string>> = {
  project: "Projects",
  folder: "Folders",
  board: "Boards",
  document: "Documents",
  file: "Files",
};

const isVisible = (node: DriveNode): boolean =>
  node.isFavorite && !node.isTrashed && !(isDocument(node) && node.isArchived);

export function FavoritesPage() {
  const tree = useWorkspaceStore(selectTree);
  const openEntity = useOpenEntity();

  const groups = useMemo(() => {
    const favorites = collectNodes(tree, isVisible);

    return GROUP_ORDER.map((type) => ({
      type,
      label: GROUP_LABELS[type],
      nodes: favorites
        .filter((node) => node.type === type)
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((group) => group.nodes.length > 0);
  }, [tree]);

  const total = groups.reduce((sum, group) => sum + group.nodes.length, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Star className="size-4 text-accent" />
        </span>
        <div className="min-w-0">
          <h1 className="text-title font-semibold tracking-tight text-foreground">Favorites</h1>
          <p className="metric truncate text-body text-faint-foreground">
            Projects, folders, boards, documents and files you starred ·{" "}
            {formatCount(total, "item")}
          </p>
        </div>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        {total === 0 ? (
          <EmptyState
            icon={Star}
            title="Nothing starred yet"
            description="Star a project, folder, board, page or file and it lands here."
            action={{ label: "Go to Drive", href: "/drive" }}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {groups.map((group) => (
              <section key={group.type} className="space-y-1.5">
                <h2 className="text-body font-semibold uppercase tracking-wider text-faint-foreground">
                  {group.label}
                  <span className="metric ml-1.5 normal-case">· {group.nodes.length}</span>
                </h2>

                {group.nodes.map((node) => {
                  const { Icon, colorClass } = nodeVisual(node);

                  return (
                    <EntityRow
                      key={node.id}
                      icon={Icon}
                      iconClassName={colorClass}
                      title={node.name}
                      subtitle={pathLabel(tree, node.id)}
                      onOpen={() => openEntity(nodeRef(node))}
                      actions={<FavoriteButton node={node} />}
                    />
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
