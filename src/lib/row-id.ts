/**
 * Custom row identifiers (`TASK-001`).
 *
 * The client only ever *formats* and *parses* them. Sequence numbers come from
 * the backend, which owns the atomic counter — see `boardService.createRow`.
 */

export const ROW_ID_PAD = 3;
const PREFIX_MAX_LENGTH = 6;
const NON_LETTERS = /[^A-Za-z]/g;

/** `TASK` + 7 → `TASK-007`. Numbers past the padding simply grow. */
export function formatRowId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(ROW_ID_PAD, "0")}`;
}

/** Board prefixes are upper-case letters only, capped for display width. */
export function normalizePrefix(value: string): string {
  return value.replace(NON_LETTERS, "").toUpperCase().slice(0, PREFIX_MAX_LENGTH);
}

export function isValidPrefix(value: string): boolean {
  return normalizePrefix(value).length >= 2;
}

export interface RowReference {
  readonly raw: string;
  readonly prefix: string;
  readonly sequence: number;
}

const REFERENCE_PATTERN = /\b([A-Z]{2,6})-(\d{1,6})\b/g;

/**
 * Pull `QA-128`-style references out of free text — what comments and global
 * search use to turn a mention into a link.
 */
export function extractRowReferences(text: string): readonly RowReference[] {
  return [...text.matchAll(REFERENCE_PATTERN)].map((match) => ({
    raw: match[0],
    prefix: match[1] ?? "",
    sequence: Number.parseInt(match[2] ?? "0", 10),
  }));
}

/** True when `query` looks like a reference to `displayId`, fully or partially. */
export function matchesRowId(displayId: string, query: string): boolean {
  const needle = query.trim().toUpperCase();
  if (needle.length === 0) return false;

  const haystack = displayId.toUpperCase();
  if (haystack.includes(needle)) return true;

  // `TASK 7` and `task-7` should both find TASK-007.
  const parts = needle.split(/[\s-]+/).filter(Boolean);
  if (parts.length !== 2) return false;

  const [prefix, digits] = parts;
  if (!prefix || !digits || !/^\d+$/.test(digits)) return false;

  const [idPrefix, idDigits] = haystack.split("-");
  return idPrefix === prefix && Number.parseInt(idDigits ?? "", 10) === Number.parseInt(digits, 10);
}
