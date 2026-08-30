import { findNodeById } from "@/lib/tree";
import type { DriveNode } from "@/types";

export interface ScopableBoard {
  readonly id: string;
  readonly nodeId: string;
  readonly name: string;
  readonly rowIdPrefix: string;
}

export function scopeBoardsToFolder<T extends ScopableBoard>(input: {
  readonly boards: readonly T[];
  readonly tree: readonly DriveNode[];
  readonly folderId: string | null;
  readonly currentNodeId: string;
  readonly allowSelf?: boolean;
}): readonly T[] {
  const { boards, tree, folderId, currentNodeId, allowSelf = false } = input;

  const container = folderId === null ? null : findNodeById(tree, folderId);

  if (folderId !== null && container === null) return [];

  const children = container && "children" in container ? container.children : tree;
  const siblingNodeIds = new Set(
    children.filter((node) => node.type === "board").map((node) => node.id),
  );

  return boards.filter(
    (board) =>
      siblingNodeIds.has(board.nodeId) &&
      (allowSelf || board.nodeId !== currentNodeId),
  );
}
