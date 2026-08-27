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

/**
 * How many leaves a branch shows before it says how many it is holding back.
 *
 * The sidebar used to show containers only, which made every folder look like
 * it held nothing but more folders — a project whose entire contents were six
 * documents rendered as an empty twisty. Showing everything is the other
 * failure: a folder with two hundred files turns the nav into the drive, and
 * the structure it exists to show scrolls off the top.
 *
 * Three is enough to say what *kind* of thing lives in a branch, which is the
 * question a nav tree actually answers. The count that follows is the honest
 * part: it says there is more, and it goes to the drive listing where the rest
 * of it is.
 */
const LEAF_PREVIEW = 3;

/**
 * Dependency-free recursive tree. Depth is unbounded; each level animates its
 * own height so expanding deep branches never reflows the whole panel.
 */
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

  // Structure first and never truncated; contents after it, and capped. A tree
  // that dropped a folder to make room for a file would be hiding the one thing
  // it is for.
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

/**
 * "+12 more", opening the folder that holds them.
 *
 * It is a link rather than an expander on purpose: the drive listing sorts,
 * filters, selects and previews, and reproducing any of that in a 240px rail
 * would be building a second file browser inside the navigation for one.
 */
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
