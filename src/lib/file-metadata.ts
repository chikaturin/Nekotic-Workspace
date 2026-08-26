import { formatBytes, formatDate, formatRelativeTime } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import type { FileMetadataEntry, FileNode } from "@/types";

/**
 * Metadata rows shown for any file — previewable or not.
 * Order is deliberate: identity first, then provenance.
 */
export function fileMetadataEntries(node: FileNode): readonly FileMetadataEntry[] {
  return [
    { label: "Name", value: node.name },
    { label: "Type", value: `${nodeVisual(node).label} · ${node.mimeType}` },
    { label: "Size", value: formatBytes(node.sizeBytes) },
    { label: "Owner", value: node.owner.name },
    { label: "Created", value: formatDate(node.createdAt) },
    { label: "Modified", value: formatRelativeTime(node.updatedAt) },
    { label: "Version", value: `v${node.version}` },
  ];
}

/** Compact one-line description used in tables and cards. */
export function fileSummaryLine(node: FileNode): string {
  return [
    node.extension ? node.extension.toUpperCase() : "FILE",
    formatBytes(node.sizeBytes),
    node.owner.name,
  ].join(" · ");
}
