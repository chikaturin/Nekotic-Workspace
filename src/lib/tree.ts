import { DRIVE_ROOT_PATH } from "@/config/app";
import {
  childrenOf,
  isContainer,
  isFile,
  type DriveLocation,
  type DriveNode,
  type SearchHit,
  type SortState,
} from "@/types";

/* ------------------------------------------------------------------ lookups */

/** Depth-first search by id across the whole forest. */
export function findNodeById(nodes: readonly DriveNode[], id: string): DriveNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;

    const hit = findNodeById(childrenOf(node), id);
    if (hit) return hit;
  }
  return null;
}

/** Chain of nodes from a root down to `id`, inclusive. Empty when not found. */
export function findPathToId(nodes: readonly DriveNode[], id: string): readonly DriveNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node];

    const deeper = findPathToId(childrenOf(node), id);
    if (deeper.length > 0) return [node, ...deeper];
  }
  return [];
}

/**
 * Resolve URL segments (`['development', 'backend']`) against the tree.
 * Unknown segments produce `isNotFound`, keeping the crumbs resolved so far.
 */
export function resolvePath(
  nodes: readonly DriveNode[],
  segments: readonly string[],
): DriveLocation {
  const ancestors: DriveNode[] = [];
  let current: DriveNode | null = null;
  let pool: readonly DriveNode[] = nodes;

  for (const segment of segments) {
    const match: DriveNode | undefined = pool.find((node) => node.slug === segment);
    if (!match) {
      return { node: current, ancestors, children: pool, isNotFound: true };
    }

    if (current) ancestors.push(current);
    current = match;
    pool = childrenOf(match);
  }

  return { node: current, ancestors, children: pool, isNotFound: false };
}

/** Absolute route for a node given its ancestor chain. */
export function buildHref(path: readonly DriveNode[]): string {
  if (path.length === 0) return DRIVE_ROOT_PATH;
  return `${DRIVE_ROOT_PATH}/${path.map((node) => node.slug).join("/")}`;
}

/** Absolute route for a node id, resolved from the forest. */
export function hrefForNode(nodes: readonly DriveNode[], id: string): string {
  return buildHref(findPathToId(nodes, id));
}

/** `Development / Backend` — ancestor labels, excluding the node itself. */
export function pathLabel(nodes: readonly DriveNode[], id: string): string {
  const path = findPathToId(nodes, id);
  const ancestors = path.slice(0, -1);
  return ancestors.length > 0 ? ancestors.map((node) => node.name).join(" / ") : "Workspace root";
}

/* ----------------------------------------------------------------- mutation */

type NodeUpdater = (node: DriveNode) => DriveNode;

/**
 * Return a new forest with `id` replaced by `updater(node)`. Never mutates.
 * Branches that did not change keep their identity, so React can skip them.
 */
export function updateNode(
  nodes: readonly DriveNode[],
  id: string,
  updater: NodeUpdater,
): readonly DriveNode[] {
  const next = nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (!isContainer(node)) return node;

    const nextChildren = updateNode(node.children, id, updater);
    return nextChildren === node.children ? node : { ...node, children: nextChildren };
  });

  return next.some((node, index) => node !== nodes[index]) ? next : nodes;
}

/** Return a new forest without `id`, plus the node that was removed. */
export function removeNode(
  nodes: readonly DriveNode[],
  id: string,
): { tree: readonly DriveNode[]; removed: DriveNode | null } {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const removed = nodes[index] ?? null;
    return { tree: nodes.filter((_, position) => position !== index), removed };
  }

  for (let position = 0; position < nodes.length; position += 1) {
    const node = nodes[position];
    if (!node || !isContainer(node)) continue;

    const result = removeNode(node.children, id);
    if (!result.removed) continue;

    const tree = nodes.map((sibling, siblingIndex) =>
      siblingIndex === position ? { ...node, children: result.tree } : sibling,
    );
    return { tree, removed: result.removed };
  }

  return { tree: nodes, removed: null };
}

/**
 * Insert `child` into `parentId` (or at the forest root when null).
 * Children stay sorted by the caller; insertion appends.
 */
export function insertNode(
  nodes: readonly DriveNode[],
  parentId: string | null,
  child: DriveNode,
): readonly DriveNode[] {
  if (parentId === null) return [...nodes, child];

  return updateNode(nodes, parentId, (parent) =>
    isContainer(parent) ? { ...parent, children: [...parent.children, child] } : parent,
  );
}

/** True when `descendantId` sits anywhere below `ancestorId`. */
export function isDescendantOf(
  nodes: readonly DriveNode[],
  ancestorId: string,
  descendantId: string,
): boolean {
  const ancestor = findNodeById(nodes, ancestorId);
  if (!ancestor) return false;
  return findNodeById(childrenOf(ancestor), descendantId) !== null;
}

export type MoveRejection = "same-parent" | "into-self" | "into-descendant" | "invalid-target";

export interface MoveResult {
  readonly tree: readonly DriveNode[];
  readonly moved: DriveNode | null;
  readonly rejection: MoveRejection | null;
}

/**
 * Move a node under a new container, rejecting cycles and no-op drops.
 * Returns the original tree untouched when the move is not allowed.
 */
export function moveNode(
  nodes: readonly DriveNode[],
  nodeId: string,
  targetParentId: string | null,
): MoveResult {
  const source = findNodeById(nodes, nodeId);
  if (!source) return { tree: nodes, moved: null, rejection: "invalid-target" };
  if (nodeId === targetParentId) return { tree: nodes, moved: null, rejection: "into-self" };
  if (source.parentId === targetParentId) {
    return { tree: nodes, moved: null, rejection: "same-parent" };
  }

  if (targetParentId !== null) {
    const target = findNodeById(nodes, targetParentId);
    if (!target || !isContainer(target)) {
      return { tree: nodes, moved: null, rejection: "invalid-target" };
    }
    if (isDescendantOf(nodes, nodeId, targetParentId)) {
      return { tree: nodes, moved: null, rejection: "into-descendant" };
    }
  }

  const { tree: pruned, removed } = removeNode(nodes, nodeId);
  if (!removed) return { tree: nodes, moved: null, rejection: "invalid-target" };

  const relocated: DriveNode = { ...removed, parentId: targetParentId };
  return { tree: insertNode(pruned, targetParentId, relocated), moved: relocated, rejection: null };
}

/**
 * Deep-copy a node under a new parent, minting a fresh id for every descendant.
 * Slug uniqueness is the caller's job — it needs the sibling list.
 */
export function cloneNode(
  node: DriveNode,
  parentId: string | null,
  idFactory: () => string,
): DriveNode {
  const id = idFactory();
  const base = { ...node, id, parentId, isFavorite: false, isShared: false };

  if (!isContainer(base)) return base;

  return {
    ...base,
    children: base.children.map((child) => cloneNode(child, id, idFactory)),
  };
}

/* ------------------------------------------------------------- aggregations */

export function flattenTree(nodes: readonly DriveNode[]): readonly DriveNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(childrenOf(node))]);
}

/** Total bytes stored below (and including) a node. */
export function totalSize(node: DriveNode): number {
  if (isFile(node)) return node.sizeBytes;
  return childrenOf(node).reduce((sum, child) => sum + totalSize(child), 0);
}

/** Direct child count, used for folder subtitles. */
export function childCount(node: DriveNode): number {
  return childrenOf(node).length;
}

/** Files directly inside a container (or the forest root), minus the trash. */
export function visibleFilesOf(
  nodes: readonly DriveNode[],
  folder: DriveNode | null,
): readonly DriveNode[] {
  const pool = folder ? childrenOf(folder) : nodes;
  return pool.filter((node) => isFile(node) && !node.isTrashed);
}

/* ---------------------------------------------------------------- filtering */

const TYPE_WEIGHT: Record<DriveNode["type"], number> = {
  project: 0,
  folder: 1,
  document: 2,
  board: 3,
  file: 4,
};

/** Containers first, then the requested key. Sorting is stable and pure. */
export function sortNodes(nodes: readonly DriveNode[], sort: SortState): readonly DriveNode[] {
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...nodes].sort((a, b) => {
    const groupDelta = TYPE_WEIGHT[a.type] - TYPE_WEIGHT[b.type];
    if (groupDelta !== 0 && sort.key !== "name") return groupDelta;

    switch (sort.key) {
      case "name":
        return factor * a.name.localeCompare(b.name, undefined, { numeric: true });
      case "updatedAt":
        return factor * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      case "size":
        return factor * (totalSize(a) - totalSize(b));
      case "type":
        return factor * (groupDelta || a.name.localeCompare(b.name));
      default:
        return 0;
    }
  });
}

/** Case-insensitive name search across the forest, capped at `limit` hits. */
export function searchNodes(
  nodes: readonly DriveNode[],
  query: string,
  limit: number,
): readonly SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  return flattenTree(nodes)
    .filter((node) => !node.isTrashed && node.name.toLowerCase().includes(needle))
    .slice(0, limit)
    .map((node) => ({
      node,
      path: pathLabel(nodes, node.id),
      href: hrefForNode(nodes, node.id),
    }));
}

/** Nodes matching a predicate, flattened — powers the smart views. */
export function collectNodes(
  nodes: readonly DriveNode[],
  predicate: (node: DriveNode) => boolean,
): readonly DriveNode[] {
  return flattenTree(nodes).filter(predicate);
}
