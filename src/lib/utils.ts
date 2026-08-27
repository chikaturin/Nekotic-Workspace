import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Merge conditional class names with Tailwind conflict resolution.
 *
 * The extension is not optional. tailwind-merge recognises a class by name,
 * not by what the theme says it does, so every token this design system adds
 * is a class it has never heard of — and its fallback guess for an unknown
 * `text-*` is *text colour*. That guess is silently destructive:
 *
 *     twMerge("text-foreground", "text-ui")   // -> "text-ui"        colour lost
 *     twMerge("text-ui", "text-foreground")   // -> "text-foreground"  size lost
 *
 * Both are in the same group as far as it is concerned, so the last one wins
 * and the other is dropped. Nothing errors, nothing warns; a badge simply
 * renders with no tone, or a label with no size. Registering the scales is
 * what makes a size and a colour two independent decisions again.
 */
const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["micro", "body", "ui", "lead", "title", "display", "code"],
        },
      ],
      shadow: [{ shadow: ["raise", "pop", "float"] }],
      z: [{ z: ["base", "raised", "sticky", "overlay", "dropdown", "modal", "toast", "tooltip"] }],
      opacity: ["is-disabled", "is-dragging", "is-pending", "is-frozen"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
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
