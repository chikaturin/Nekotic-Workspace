import type { SearchGroup, SearchResult, SearchResultKind } from "@/types";

/**
 * Ranking and grouping for global search.
 *
 * Scoring is deliberately explainable rather than fuzzy: an exact hit beats a
 * prefix, a prefix beats a word start, a word start beats a loose substring.
 * The result order is therefore reproducible in a test.
 */

export const SEARCH_GROUP_ORDER: readonly SearchResultKind[] = [
  "document",
  "api",
  "bug",
  "qa",
  "row",
  "file",
  "comment",
  "place",
] as const;

export const SEARCH_GROUP_LABELS: Readonly<Record<SearchResultKind, string>> = {
  document: "Documents",
  api: "API endpoints",
  bug: "Bugs",
  qa: "QA cases",
  row: "Records",
  file: "Files",
  comment: "Comments",
  place: "Places",
};

const EXACT = 100;
const PREFIX = 70;
const WORD_START = 50;
const SUBSTRING = 30;

/** 0 means "no match" — callers drop anything that scores zero. */
export function scoreMatch(haystack: string, needle: string): number {
  const text = haystack.trim().toLowerCase();
  const query = needle.trim().toLowerCase();
  if (query.length === 0 || text.length === 0) return 0;

  if (text === query) return EXACT;
  if (text.startsWith(query)) return PREFIX;

  const at = text.indexOf(query);
  if (at < 0) return 0;

  const preceding = text[at - 1] ?? " ";
  return /[\s/_\-.:]/.test(preceding) ? WORD_START : SUBSTRING;
}

/** A short window of text around the match, for comment and long-text hits. */
export function snippetAround(text: string, needle: string, radius = 48): string {
  const at = text.toLowerCase().indexOf(needle.trim().toLowerCase());
  if (at < 0) return text.slice(0, radius * 2).trim();

  const from = Math.max(0, at - radius);
  const to = Math.min(text.length, at + needle.length + radius);

  return `${from > 0 ? "…" : ""}${text.slice(from, to).trim()}${to < text.length ? "…" : ""}`;
}

/**
 * Bucket results by kind in the fixed group order, best score first inside
 * each group, capped so one noisy board cannot crowd out every other kind.
 */
export function groupResults(
  results: readonly SearchResult[],
  limitPerGroup: number,
): readonly SearchGroup[] {
  const buckets = new Map<SearchResultKind, SearchResult[]>();

  for (const result of results) {
    const bucket = buckets.get(result.kind);
    if (bucket) bucket.push(result);
    else buckets.set(result.kind, [result]);
  }

  const groups: SearchGroup[] = [];

  for (const kind of SEARCH_GROUP_ORDER) {
    const bucket = buckets.get(kind);
    if (!bucket || bucket.length === 0) continue;

    groups.push({
      kind,
      label: SEARCH_GROUP_LABELS[kind],
      results: bucket
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
        .slice(0, limitPerGroup),
    });
  }

  return groups;
}

export function totalResults(groups: readonly SearchGroup[]): number {
  return groups.reduce((total, group) => total + group.results.length, 0);
}

/** Flat list in render order — what the palette's keyboard navigation walks. */
export function flattenGroups(groups: readonly SearchGroup[]): readonly SearchResult[] {
  return groups.flatMap((group) => group.results);
}
