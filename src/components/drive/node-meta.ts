import { formatBytes, formatCount, formatRelativeTime } from "@/lib/format";
import { childCount, totalSize } from "@/lib/tree";
import { nodeVisual } from "@/lib/node-visuals";
import { isBoard, isContainer, isDocument, isFile, type DriveNode } from "@/types";

export function describeNode(node: DriveNode): string {
  const updated = formatRelativeTime(node.updatedAt);

  if (isContainer(node)) {
    const size = totalSize(node);
    const items = formatCount(childCount(node), "item");
    return size > 0 ? `${items} · ${formatBytes(size)} · ${updated}` : `${items} · ${updated}`;
  }

  if (isDocument(node)) {
    const summary = node.excerpt.length > 0 ? node.excerpt : "Empty page";
    return `${summary} · ${updated}`;
  }

  if (isBoard(node)) {
    return `${node.openCount}/${node.itemCount} open · ${updated}`;
  }

  if (isFile(node)) {
    return `${node.extension.toUpperCase()} · ${formatBytes(node.sizeBytes)} · ${updated}`;
  }

  return updated;
}

export function typeLabel(node: DriveNode): string {
  return nodeVisual(node).label;
}

export function sizeLabel(node: DriveNode): string {
  if (isDocument(node)) return `${node.blockCount} blocks`;
  if (isBoard(node)) return `${node.itemCount} items`;
  const size = totalSize(node);
  return size > 0 ? formatBytes(size) : "—";
}
