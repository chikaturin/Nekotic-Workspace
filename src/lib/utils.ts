import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["micro", "body", "ui", "lead", "title", "display", "code"],
        },
      ],
      shadow: [{ shadow: ["raise", "pop", "float"] }],
      z: [
        {
          z: [
            "base",
            "raised",
            "sticky",
            "sticky-header",
            "overlay",
            "dropdown",
            "modal",
            "toast",
            "tooltip",
          ],
        },
      ],
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

export function uniqueSlug(base: string, taken: readonly string[]): string {
  const seed = base.length > 0 ? base : "untitled";
  if (!taken.includes(seed)) return seed;

  let suffix = 2;
  while (taken.includes(`${seed}-${suffix}`)) suffix += 1;
  return `${seed}-${suffix}`;
}

export function createId(prefix: string, seed: number): string {
  return `${prefix}_${seed.toString(36)}`;
}
