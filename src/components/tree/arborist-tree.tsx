"use client";

import { ChevronRight, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Tree, type NodeApi, type NodeRendererProps } from "react-arborist";
import { DRIVE_ROOT_PATH, TREE_INDENT, TREE_ROW_HEIGHT } from "@/config/app";
import { useContainerSize } from "@/hooks/use-container-size";
import { isArchivedNode } from "@/lib/archive";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { childrenOf, isContainer, type DriveNode } from "@/types";

const TREE_VIEWPORT_CLASS = "h-[min(52vh,460px)] w-full";

/**
 * react-arborist engine — virtualised rows plus its own react-dnd drag layer.
 * Interchangeable with `FolderTree`; selected via `TREE_ENGINE` in app config.
 */
export function ArboristTree({ nodes }: { nodes: readonly DriveNode[] }) {
  const [ref, size] = useContainerSize<HTMLDivElement>();
  const moveNode = useWorkspaceStore((state) => state.moveNode);

  const handleMove = useCallback(
    ({ dragIds, parentId }: { dragIds: string[]; parentId: string | null }) => {
      for (const dragId of dragIds) moveNode(dragId, parentId);
    },
    [moveNode],
  );

  return (
    <div ref={ref} className={TREE_VIEWPORT_CLASS}>
      {size.height > 0 && (
        <Tree<DriveNode>
          data={nodes.filter((node) => !node.isTrashed && !isArchivedNode(node))}
          idAccessor="id"
          childrenAccessor={(node) => (isContainer(node) ? [...childrenOf(node)] : null)}
          width={size.width}
          height={size.height}
          indent={TREE_INDENT}
          rowHeight={TREE_ROW_HEIGHT}
          openByDefault={false}
          disableMultiSelection
          onMove={handleMove}
          className="no-scrollbar"
        >
          {ArboristRow}
        </Tree>
      )}
    </div>
  );
}

/** Absolute drive route for an arborist node, walked up through its parents. */
function hrefFor(node: NodeApi<DriveNode>): string {
  const segments: string[] = [];
  let current: NodeApi<DriveNode> | null = node;

  while (current && current.level >= 0) {
    segments.unshift(current.data.slug);
    current = current.parent;
  }

  return `${DRIVE_ROOT_PATH}/${segments.join("/")}`;
}

function ArboristRow({ node, style, dragHandle }: NodeRendererProps<DriveNode>) {
  const router = useRouter();
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const container = isContainer(node.data);
  const { Icon, colorClass } = nodeVisual(node.data, node.isOpen);

  function activate() {
    if (node.data.type === "file") {
      openPreview(node.data.id);
      return;
    }
    router.push(hrefFor(node));
  }

  return (
    <div
      ref={dragHandle}
      style={style}
      onClick={activate}
      className={cn(
        "group flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md pr-2 text-lead transition-colors",
        node.isSelected
          ? "bg-selection text-foreground"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
        node.willReceiveDrop && "bg-accent-soft ring-1 ring-accent",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center pl-1">
        {container && (
          <button
            type="button"
            aria-label={node.isOpen ? `Collapse ${node.data.name}` : `Expand ${node.data.name}`}
            onClick={(event) => {
              event.stopPropagation();
              node.toggle();
            }}
            className="rounded p-0.5 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-3 transition-transform duration-200", node.isOpen && "rotate-90")}
            />
          </button>
        )}
      </span>

      <Icon className={cn("size-4 shrink-0", colorClass)} />
      <span className="min-w-0 flex-1 truncate">{node.data.name}</span>
      {node.data.isFavorite && <Star className="size-3 shrink-0 fill-accent text-accent" />}
    </div>
  );
}
