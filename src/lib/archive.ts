import { findPathToId } from "@/lib/tree";
import type { BoardRow, CapabilitySet, DriveNode } from "@/types";

/**
 * Archiving (SY-ARC-37).
 *
 * Archived means frozen, not hidden away: the content stays readable and
 * addressable, and every write path is closed until it is restored. The state
 * is *inherited* — a board inside an archived project is read-only even though
 * its own flag is unset — so nothing branches on `node.isArchived` directly.
 */

export const isArchivedNode = (node: DriveNode): boolean => node.isArchived === true;

/**
 * The archived node at or above `nodeId` — the one to name in the banner and
 * the one whose Restore button ends the freeze. Null when nothing is archived.
 */
export function archiveSourceOf(
  tree: readonly DriveNode[],
  nodeId: string | null,
): DriveNode | null {
  if (!nodeId) return null;

  // Root-first, so the outermost archive is the one reported: restoring a page
  // inside an archived project would not actually unfreeze it.
  return findPathToId(tree, nodeId).find(isArchivedNode) ?? null;
}

/**
 * The archived *ancestor* freezing this node, if any.
 *
 * Self-archiving and inherited archiving are deliberately different: you can
 * always restore the thing you are standing on, but a page inside an archived
 * project cannot be thawed on its own — the project has to be restored first.
 */
export function inheritedArchiveOf(
  tree: readonly DriveNode[],
  nodeId: string | null,
): DriveNode | null {
  if (!nodeId) return null;

  const path = findPathToId(tree, nodeId);
  return path.slice(0, -1).find(isArchivedNode) ?? null;
}

/** Archiving narrows an existing capability set — it can never widen one. */
export function archivedCapabilities(base: CapabilitySet): CapabilitySet {
  return { ...base, edit: false, upload: false };
}

export const isRowArchived = (row: BoardRow): boolean =>
  typeof row.archivedAt === "string" && row.archivedAt.length > 0;

/** Label for the banner: what kind of thing is frozen. */
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
