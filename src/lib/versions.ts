import { documentLines } from "@/lib/blocks";
import { diffLines } from "@/lib/diff";
import type {
  ConfigVersion,
  DiffLine,
  DocumentVersion,
  SecretDocument,
  VersionEntry,
} from "@/types";

/**
 * Version history (SY-VER-39), one shape for three subjects.
 *
 * A page, a config file and a secret document keep very different things, so
 * each is projected onto the same `VersionEntry` before the UI sees it. The
 * projection is where the difference is honest: a secret's history records
 * *that* a key rotated and never carries the value, so `hasSnapshot` is false
 * and neither compare nor restore is offered for it.
 */

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

/**
 * A secret document's history is its rotations. There is no snapshot because
 * the client never holds the plaintext to snapshot — the masks it does hold
 * would diff as identical and say nothing true.
 */
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

/** What changed between a stored version and what is on screen now. */
export function compareToCurrent(
  entry: VersionEntry,
  current: readonly string[],
): readonly DiffLine[] {
  return diffLines(entry.lines, current);
}
