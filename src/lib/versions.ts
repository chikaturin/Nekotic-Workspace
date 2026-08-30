import { documentLines } from "@/lib/blocks";
import { diffLines } from "@/lib/diff";
import type {
  ConfigVersion,
  DiffLine,
  DocumentVersion,
  SecretDocument,
  VersionEntry,
} from "@/types";

export function documentVersionEntry(version: DocumentVersion): VersionEntry {
  return {
    id: version.id,
    version: version.version,
    createdAt: version.createdAt,
    author: version.author,
    summary: version.summary,
    lines: documentLines(version.blocks),
    hasSnapshot: true,
  };
}

export function configVersionEntry(version: ConfigVersion): VersionEntry {
  return {
    id: version.id,
    version: version.version,
    createdAt: version.createdAt,
    author: version.author,
    summary: version.summary,
    lines: version.content.split("\n"),
    hasSnapshot: true,
  };
}

export function secretRotationEntries(document: SecretDocument): readonly VersionEntry[] {
  return [...document.entries]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((entry, index) => ({
      id: entry.id,
      version: document.entries.length - index,
      createdAt: entry.updatedAt,
      author: entry.rotatedBy,
      summary: `rotated ${entry.key}`,
      lines: [],
      hasSnapshot: false,
    }));
}

export function compareToCurrent(
  entry: VersionEntry,
  current: readonly string[],
): readonly DiffLine[] {
  return diffLines(entry.lines, current);
}
