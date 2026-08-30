
export const ROW_ID_PAD = 3;
const PREFIX_MAX_LENGTH = 6;
const NON_LETTERS = /[^A-Za-z]/g;

export function formatRowId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(ROW_ID_PAD, "0")}`;
}

export function normalizePrefix(value: string): string {
  return value.replace(NON_LETTERS, "").toUpperCase().slice(0, PREFIX_MAX_LENGTH);
}

export interface RowReference {
  readonly raw: string;
  readonly prefix: string;
  readonly sequence: number;
}

export const ROW_REFERENCE_SOURCE = "\\b([A-Z]{2,6})-(\\d{1,6})\\b";

const REFERENCE_PATTERN = new RegExp(ROW_REFERENCE_SOURCE, "g");

export function extractRowReferences(text: string): readonly RowReference[] {
  return [...text.matchAll(REFERENCE_PATTERN)].map((match) => ({
    raw: match[0],
    prefix: match[1] ?? "",
    sequence: Number.parseInt(match[2] ?? "0", 10),
  }));
}

export function matchesRowId(displayId: string, query: string): boolean {
  const needle = query.trim().toUpperCase();
  if (needle.length === 0) return false;

  const haystack = displayId.toUpperCase();
  if (haystack.includes(needle)) return true;

  const parts = needle.split(/[\s-]+/).filter(Boolean);
  if (parts.length !== 2) return false;

  const [prefix, digits] = parts;
  if (!prefix || !digits || !/^\d+$/.test(digits)) return false;

  const [idPrefix, idDigits] = haystack.split("-");
  return idPrefix === prefix && Number.parseInt(idDigits ?? "", 10) === Number.parseInt(digits, 10);
}
