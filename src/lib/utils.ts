import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const COMBINING_MARKS = /[̀-ͯ]/g;
const D_WITH_STROKE = /[đĐ]/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const SLUG_MAX_LENGTH = 60;

/** URL-safe segment derived from a display name (Vietnamese-aware). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(D_WITH_STROKE, "d")
    .toLowerCase()
    .trim()
    .replace(NON_SLUG_CHARS, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/** Ensure a slug is unique among the ones already taken by siblings. */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  const seed = base.length > 0 ? base : "untitled";
  if (!taken.includes(seed)) return seed;

  let suffix = 2;
  while (taken.includes(`${seed}-${suffix}`)) suffix += 1;
  return `${seed}-${suffix}`;
}

/** Stable id generator for mock-side node creation. */
export function createId(prefix: string, seed: number): string {
  return `${prefix}_${seed.toString(36)}`;
}
