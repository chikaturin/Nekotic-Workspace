import { hrefForNode } from "@/lib/tree";
import {
  isBoard,
  isDocument,
  isFile,
  isProject,
  type DriveNode,
  type EntityKind,
  type EntityRef,
  type WatchKind,
} from "@/types";

export function refKey(ref: EntityRef): string {
  return ref.kind === "row" ? `row:${ref.boardId ?? ref.nodeId}:${ref.rowId}` : `${ref.kind}:${ref.nodeId}`;
}

export function refEquals(a: EntityRef, b: EntityRef): boolean {
  return refKey(a) === refKey(b);
}

export function entityKindOf(node: DriveNode): EntityKind {
  if (isProject(node)) return "project";
  if (isDocument(node)) return "document";
  if (isBoard(node)) return "board";
  if (isFile(node)) return "file";
  return "folder";
}

export function nodeRef(node: DriveNode): EntityRef {
  return { kind: entityKindOf(node), nodeId: node.id, label: node.name };
}

export interface RowRefInput {
  readonly nodeId: string;
  readonly boardId: string;
  readonly rowId: string;
  readonly label: string;
}

export function rowRef({ nodeId, boardId, rowId, label }: RowRefInput): EntityRef {
  return { kind: "row", nodeId, boardId, rowId, label };
}

export function hrefForRef(tree: readonly DriveNode[], ref: EntityRef): string {
  return hrefForNode(tree, ref.nodeId);
}

export function opensDrawer(ref: EntityRef): ref is EntityRef & { rowId: string } {
  return ref.kind === "row" && typeof ref.rowId === "string";
}

const WATCHABLE: ReadonlySet<EntityKind> = new Set<EntityKind>(["row", "document", "board"]);

export function isWatchable(ref: EntityRef): ref is EntityRef & { kind: WatchKind } {
  return WATCHABLE.has(ref.kind);
}
