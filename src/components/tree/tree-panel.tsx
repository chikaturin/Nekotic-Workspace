"use client";

import { FolderOpen } from "lucide-react";
import { ArboristTree } from "@/components/tree/arborist-tree";
import { FolderTree } from "@/components/tree/folder-tree";
import { TREE_ENGINE } from "@/config/app";
import type { DriveNode } from "@/types";

interface TreePanelProps {
  readonly nodes: readonly DriveNode[];
}

/**
 * Single entry point for the sidebar tree. Swap engines from `TREE_ENGINE`:
 * `recursive` (default, animated, unbounded depth) or `arborist` (virtualised).
 */
export function TreePanel({ nodes }: TreePanelProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
        <FolderOpen className="size-5 text-faint-foreground" />
        <p className="text-ui text-faint-foreground">No projects yet</p>
      </div>
    );
  }

  return TREE_ENGINE === "arborist" ? <ArboristTree nodes={nodes} /> : <FolderTree nodes={nodes} />;
}
