import { TRASH_RETENTION_DAYS } from "@/config/app";
import { DAY_MS, dayIndex } from "@/lib/board-dates";
import { findNodeById, findPathToId, pathLabel, removeNode } from "@/lib/tree";
import { childrenOf, isContainer, type DriveNode, type TrashEntry, type UserSummary } from "@/types";

/**
 * Soft delete (SY-TRH-38).
 *
 * Deleting *detaches* the subtree from the tree and parks it here. That is the
 * whole point: a folder can be purged for good while a page deleted out of it
 * earlier survives, which is the one case where restoring has to find the item
 * a new home — and say so.
 */

export interface TrashStamp {
  readonly deletedAt: string;
  readonly deletedBy: UserSummary;
}

/** Mark a subtree as trashed so nothing that walks it treats it as live. */
function markTrashed(node: DriveNode): DriveNode {
  const flagged = { ...node, isTrashed: true };
  if (!isContainer(flagged)) return flagged;

  return { ...flagged, children: flagged.children.map(markTrashed) };
}

/** Detach one node and describe where it used to live. */
export function trashNodeFrom(
  tree: readonly DriveNode[],
  nodeId: string,
  stamp: TrashStamp,
): { readonly tree: readonly DriveNode[]; readonly entry: TrashEntry | null } {
  const node = findNodeById(tree, nodeId);
  if (!node) return { tree, entry: null };

  const ancestors = findPathToId(tree, nodeId).slice(0, -1);
  const { tree: pruned, removed } = removeNode(tree, nodeId);
  if (!removed) return { tree, entry: null };

  return {
    tree: pruned,
    entry: {
      id: nodeId,
      node: markTrashed(removed),
      deletedAt: stamp.deletedAt,
      deletedBy: stamp.deletedBy,
      originalAncestorIds: ancestors.map((ancestor) => ancestor.id),
      // Resolved now, while the ancestors still exist — after a purge there is
      // nothing left to resolve it from.
      originalPath: pathLabel(tree, nodeId),
    },
  };
}

/**
 * Pull nodes the dataset ships as already-deleted into the bin, so the seeded
 * tree and the trash view agree on one representation.
 */
export function extractTrashed(
  tree: readonly DriveNode[],
  stampFor: (node: DriveNode) => TrashStamp,
): { readonly tree: readonly DriveNode[]; readonly entries: readonly TrashEntry[] } {
  const nodes: DriveNode[] = [];

  // Topmost first: a trashed node inside a trashed folder travels with it.
  const walk = (pool: readonly DriveNode[]) => {
    for (const node of pool) {
      if (node.isTrashed) {
        nodes.push(node);
        continue;
      }
      walk(childrenOf(node));
    }
  };
  walk(tree);

  let current = tree;
  const entries: TrashEntry[] = [];

  for (const node of nodes) {
    const result = trashNodeFrom(current, node.id, stampFor(node));
    current = result.tree;
    if (result.entry) entries.push(result.entry);
  }

  return { tree: current, entries };
}

export interface RestoreTarget {
  readonly parentId: string | null;
  /** True when the original parent is gone and the node lands elsewhere. */
  readonly isRelocated: boolean;
}

/**
 * Where a restore should put the node back.
 *
 * The original parent wins. When it has been purged the search walks *up* the
 * recorded ancestor chain to the deepest container still standing, and falls
 * back to the workspace root — never to nowhere.
 */
export function restoreTargetFor(tree: readonly DriveNode[], entry: TrashEntry): RestoreTarget {
  const original = entry.node.parentId;

  for (const candidate of [...entry.originalAncestorIds].reverse()) {
    const node = findNodeById(tree, candidate);
    if (!node || !isContainer(node) || node.isTrashed) continue;

    return { parentId: candidate, isRelocated: candidate !== original };
  }

  return { parentId: null, isRelocated: original !== null };
}

/** Restore puts the subtree back live; the flag is the caller's to clear. */
export function untrash(node: DriveNode, parentId: string | null): DriveNode {
  const restored = { ...node, isTrashed: false, parentId };
  if (!isContainer(restored)) return restored;

  return {
    ...restored,
    children: restored.children.map((child) => untrash(child, restored.id)),
  };
}

/**
 * Days left before the retention window closes. Null once it has passed —
 * the backend owns the sweep, so the UI reports "due" rather than inventing it.
 */
export function daysRemaining(deletedAt: string, nowIso: string): number | null {
  const deleted = Date.parse(deletedAt);
  if (Number.isNaN(deleted)) return null;

  const elapsed = dayIndex(nowIso) - Math.floor(deleted / DAY_MS);
  const left = TRASH_RETENTION_DAYS - elapsed;
  return left > 0 ? left : null;
}

/** Most recently deleted first — the order anybody looking for a mistake wants. */
export function sortTrash(entries: readonly TrashEntry[]): readonly TrashEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}
