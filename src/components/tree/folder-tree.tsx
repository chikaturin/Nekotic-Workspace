"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { TreeRow } from "@/components/tree/tree-row";
import { DRIVE_ROOT_PATH } from "@/config/app";
import { isArchivedNode } from "@/lib/archive";
import { childrenOf, isContainer, type DriveNode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

interface FolderTreeProps {
  readonly nodes: readonly DriveNode[];
  /** Leaves are hidden in the sidebar by default — the drive view lists them. */
  readonly showLeaves?: boolean;
}

/**
 * Dependency-free recursive tree. Depth is unbounded; each level animates its
 * own height so expanding deep branches never reflows the whole panel.
 */
export function FolderTree({ nodes, showLeaves = false }: FolderTreeProps) {
  return <TreeLevel nodes={nodes} depth={0} parentHref={DRIVE_ROOT_PATH} showLeaves={showLeaves} />;
}

interface TreeLevelProps extends FolderTreeProps {
  readonly depth: number;
  readonly parentHref: string;
}

function TreeLevel({ nodes, depth, parentHref, showLeaves }: TreeLevelProps) {
  const pathname = usePathname();
  const expandedIds = useWorkspaceStore((state) => state.expandedIds);
  const toggleExpanded = useWorkspaceStore((state) => state.toggleExpanded);

  const visible = nodes.filter(
    (node) => !node.isTrashed && !isArchivedNode(node) && (showLeaves || isContainer(node)),
  );
  if (visible.length === 0) return null;

  return (
    <div role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Project tree" : undefined}>
      {visible.map((node) => {
        const href = `${parentHref}/${node.slug}`;
        const isExpanded = expandedIds.includes(node.id);
        const children = childrenOf(node);

        return (
          <Fragment key={node.id}>
            <TreeRow
              node={node}
              depth={depth}
              href={href}
              isExpanded={isExpanded}
              isActive={pathname === href}
              onToggle={toggleExpanded}
            />

            <AnimatePresence initial={false}>
              {isExpanded && children.length > 0 && (
                <motion.div
                  key={`${node.id}-children`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <TreeLevel
                    nodes={children}
                    depth={depth + 1}
                    parentHref={href}
                    showLeaves={showLeaves}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Fragment>
        );
      })}
    </div>
  );
}
