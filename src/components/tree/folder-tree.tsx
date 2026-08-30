"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { Fragment } from "react";
import { TreeRow } from "@/components/tree/tree-row";
import { DRIVE_ROOT_PATH, TREE_INDENT } from "@/config/app";
import { isArchivedNode } from "@/lib/archive";
import { routableHref } from "@/lib/exported-routes";
import { childrenOf, isContainer, type DriveNode } from "@/types";
import { useWorkspaceStore } from "@/store/workspace-store";

interface FolderTreeProps {
  readonly nodes: readonly DriveNode[];
}

const LEAF_PREVIEW = 3;

export function FolderTree({ nodes }: FolderTreeProps) {
  return <TreeLevel nodes={nodes} depth={0} parentHref={DRIVE_ROOT_PATH} />;
}

interface TreeLevelProps extends FolderTreeProps {
  readonly depth: number;
  readonly parentHref: string;
}

function TreeLevel({ nodes, depth, parentHref }: TreeLevelProps) {
  const pathname = usePathname();
  const expandedIds = useWorkspaceStore((state) => state.expandedIds);
  const toggleExpanded = useWorkspaceStore((state) => state.toggleExpanded);

  const visible = nodes.filter((node) => !node.isTrashed && !isArchivedNode(node));

  const containers = visible.filter(isContainer);
  const leaves = visible.filter((node) => !isContainer(node));
  const shown = [...containers, ...leaves.slice(0, LEAF_PREVIEW)];
  const held = leaves.length - Math.min(leaves.length, LEAF_PREVIEW);

  if (shown.length === 0) return null;

  return (
    <div role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Project tree" : undefined}>
      {shown.map((node) => {
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
                  <TreeLevel nodes={children} depth={depth + 1} parentHref={href} />
                </motion.div>
              )}
            </AnimatePresence>
          </Fragment>
        );
      })}

      {held > 0 && <MoreRow count={held} depth={depth} href={parentHref} />}
    </div>
  );
}

function MoreRow({
  count,
  depth,
  href,
}: {
  readonly count: number;
  readonly depth: number;
  readonly href: string;
}) {
  return (
    <Link
      href={routableHref(href)}
      className="group flex h-[26px] w-full items-center gap-1.5 rounded-md pr-2 text-body text-faint-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex size-4 shrink-0 items-center justify-center"
        style={{ marginLeft: depth * TREE_INDENT + 4 }}
      />
      <Ellipsis aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {count} more item{count === 1 ? "" : "s"}
      </span>
    </Link>
  );
}
