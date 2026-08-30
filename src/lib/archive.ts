import { findPathToId } from "@/lib/tree";
import type { BoardRow, CapabilitySet, DriveNode } from "@/types";

export const isArchivedNode = (node: DriveNode): boolean => node.isArchived === true;

export function archiveSourceOf(
  tree: readonly DriveNode[],
  nodeId: string | null,
): DriveNode | null {
  if (!nodeId) return null;

  return findPathToId(tree, nodeId).find(isArchivedNode) ?? null;
}

export function inheritedArchiveOf(
  tree: readonly DriveNode[],
  nodeId: string | null,
): DriveNode | null {
  if (!nodeId) return null;

  const path = findPathToId(tree, nodeId);
  return path.slice(0, -1).find(isArchivedNode) ?? null;
}

export function archivedCapabilities(base: CapabilitySet): CapabilitySet {
  return { ...base, edit: false, upload: false };
}

export const isRowArchived = (row: BoardRow): boolean =>
  typeof row.archivedAt === "string" && row.archivedAt.length > 0;

export function archiveLabelFor(node: DriveNode): string {
  switch (node.type) {
    case "project":
      return "project";
    case "folder":
      return "folder";
    case "board":
      return "board";
    case "document":
      return "page";
    case "file":
      return "file";
  }
}
