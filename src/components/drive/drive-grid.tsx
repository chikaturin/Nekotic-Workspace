"use client";

import { motion } from "framer-motion";
import { DriveItemCard } from "@/components/drive/drive-item-card";
import type { DriveNode } from "@/types";

const CONTAINER_MOTION = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.022, delayChildren: 0.02 },
  },
};

interface DriveGridProps {
  readonly nodes: readonly DriveNode[];
  /** Route for an item — folder views append a slug, smart views resolve paths. */
  readonly resolveHref: (node: DriveNode) => string;
  readonly selectedIds: readonly string[];
  readonly onSelect: (nodeId: string, additive: boolean) => void;
  /** Changes when the folder changes, restaging the reveal animation. */
  readonly revealKey: string;
}

export function DriveGrid({ nodes, resolveHref, selectedIds, onSelect, revealKey }: DriveGridProps) {
  return (
    <motion.div
      key={revealKey}
      variants={CONTAINER_MOTION}
      initial="hidden"
      animate="visible"
      className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]"
    >
      {nodes.map((node) => (
        <DriveItemCard
          key={node.id}
          node={node}
          href={resolveHref(node)}
          isSelected={selectedIds.includes(node.id)}
          onSelect={onSelect}
        />
      ))}
    </motion.div>
  );
}
