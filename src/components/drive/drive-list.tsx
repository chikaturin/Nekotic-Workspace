"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { DriveItemRow, LIST_GRID_CLASS } from "@/components/drive/drive-item-row";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode, SortKey } from "@/types";

const CONTAINER_MOTION = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.012 } },
};

interface Column {
  readonly key: SortKey | null;
  readonly label: string;
  /** Matches the responsive visibility of the matching row cell. */
  readonly className?: string;
}

const COLUMNS: readonly Column[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: null, label: "Owner", className: "hidden lg:block" },
  { key: "size", label: "Size", className: "hidden sm:block" },
  { key: "updatedAt", label: "Updated", className: "hidden lg:block" },
  { key: null, label: "" },
];

interface DriveListProps {
  readonly nodes: readonly DriveNode[];
  readonly resolveHref: (node: DriveNode) => string;
  readonly selectedIds: readonly string[];
  readonly onSelect: (nodeId: string, additive: boolean) => void;
  readonly revealKey: string;
}

export function DriveList({ nodes, resolveHref, selectedIds, onSelect, revealKey }: DriveListProps) {
  const sort = useWorkspaceStore((state) => state.sort);
  const setSort = useWorkspaceStore((state) => state.setSort);

  function handleSort(key: SortKey) {
    setSort({
      key,
      direction: sort.key === key && sort.direction === "asc" ? "desc" : "asc",
    });
  }

  return (
    <div role="table" aria-label="Folder contents">
      <div
        role="row"
        className={cn(
          LIST_GRID_CLASS,
          "h-8 border-b border-border px-2.5 text-micro font-semibold uppercase tracking-wider text-faint-foreground",
        )}
      >
        {COLUMNS.map((column, index) =>
          column.key ? (
            <button
              key={column.label}
              type="button"
              onClick={() => handleSort(column.key as SortKey)}
              className={cn(
                "flex items-center gap-1 text-left uppercase tracking-wider transition-colors hover:text-muted-foreground",
                column.className,
              )}
            >
              {column.label}
              {sort.key === column.key &&
                (sort.direction === "asc" ? (
                  <ArrowUp className="size-3 text-accent" />
                ) : (
                  <ArrowDown className="size-3 text-accent" />
                ))}
            </button>
          ) : (
            <span key={`${column.label}-${index}`} className={column.className}>
              {column.label}
            </span>
          ),
        )}
      </div>

      <motion.div
        role="rowgroup"
        key={revealKey}
        variants={CONTAINER_MOTION}
        initial="hidden"
        animate="visible"
        className="flex flex-col pt-1"
      >
        {nodes.map((node) => (
          <DriveItemRow
            key={node.id}
            node={node}
            href={resolveHref(node)}
            isSelected={selectedIds.includes(node.id)}
            onSelect={onSelect}
          />
        ))}
      </motion.div>
    </div>
  );
}
