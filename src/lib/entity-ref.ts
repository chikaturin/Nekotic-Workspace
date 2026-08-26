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

/**
 * One address for everything collaboration points at.
 *
 * A comment, a notification, a search hit and a recent entry all carry an
 * `EntityRef`, so routing and identity are solved once rather than per feature.
 */

/** Stable identity for a target — the key comments and watches are stored under. */
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

/** Ref for a drive node — a project, folder, document, board or file. */
export function nodeRef(node: DriveNode): EntityRef {
  return { kind: entityKindOf(node), nodeId: node.id, label: node.name };
}

export interface RowRefInput {
  readonly nodeId: string;
  readonly boardId: string;
  readonly rowId: string;
  /** Display id, so the ref reads as `TASK-004` wherever it lands. */
  readonly label: string;
}

export function rowRef({ nodeId, boardId, rowId, label }: RowRefInput): EntityRef {
  return { kind: "row", nodeId, boardId, rowId, label };
}

/** Route for a ref. Rows route to their board; the drawer opens on arrival. */
export function hrefForRef(tree: readonly DriveNode[], ref: EntityRef): string {
  return hrefForNode(tree, ref.nodeId);
}

/** True when arriving at `ref` should also open the record drawer. */
export function opensDrawer(ref: EntityRef): ref is EntityRef & { rowId: string } {
  return ref.kind === "row" && typeof ref.rowId === "string";
}

const WATCHABLE: ReadonlySet<EntityKind> = new Set<EntityKind>(["row", "document", "board"]);

/** Only records, documents and boards have an activity stream to follow. */
export function isWatchable(ref: EntityRef): ref is EntityRef & { kind: WatchKind } {
  return WATCHABLE.has(ref.kind);
}
