import { TRASH_RETENTION_DAYS } from "@/config/app";
import { DAY_MS, dayIndex } from "@/lib/board-dates";
import { findNodeById, findPathToId, pathLabel, removeNode } from "@/lib/tree";
import { childrenOf, isContainer, type DriveNode, type TrashEntry, type UserSummary } from "@/types";

export interface TrashStamp {
  readonly deletedAt: string;
  readonly deletedBy: UserSummary;
}

function markTrashed(node: DriveNode): DriveNode {
  const flagged = { ...node, isTrashed: true };
  if (!isContainer(flagged)) return flagged;

  return { ...flagged, children: flagged.children.map(markTrashed) };
}

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
      originalPath: pathLabel(tree, nodeId),
    },
  };
}

export function extractTrashed(
  tree: readonly DriveNode[],
  stampFor: (node: DriveNode) => TrashStamp,
): { readonly tree: readonly DriveNode[]; readonly entries: readonly TrashEntry[] } {
  const nodes: DriveNode[] = [];

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
  readonly isRelocated: boolean;
}

export function restoreTargetFor(tree: readonly DriveNode[], entry: TrashEntry): RestoreTarget {
  const original = entry.node.parentId;

  for (const candidate of [...entry.originalAncestorIds].reverse()) {
    const node = findNodeById(tree, candidate);
    if (!node || !isContainer(node) || node.isTrashed) continue;

    return { parentId: candidate, isRelocated: candidate !== original };
  }

  return { parentId: null, isRelocated: original !== null };
}

export function untrash(node: DriveNode, parentId: string | null): DriveNode {
  const restored = { ...node, isTrashed: false, parentId };
  if (!isContainer(restored)) return restored;

  return {
    ...restored,
    children: restored.children.map((child) => untrash(child, restored.id)),
  };
}

export function daysRemaining(deletedAt: string, nowIso: string): number | null {
  const deleted = Date.parse(deletedAt);
  if (Number.isNaN(deleted)) return null;

  const elapsed = dayIndex(nowIso) - Math.floor(deleted / DAY_MS);
  const left = TRASH_RETENTION_DAYS - elapsed;
  return left > 0 ? left : null;
}

export function sortTrash(entries: readonly TrashEntry[]): readonly TrashEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}
