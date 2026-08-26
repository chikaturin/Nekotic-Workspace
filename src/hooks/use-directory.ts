"use client";

import { DIRECTORY } from "@/mock/users";
import type { DirectoryUser } from "@/types";

/**
 * People the workspace can address.
 *
 * Surfaces that are not a board — a page's comment thread, for one — need the
 * directory without loading a board snapshot to get it. The seam is here so a
 * real members endpoint replaces one hook rather than every caller.
 */
export function useDirectory(): readonly DirectoryUser[] {
  return DIRECTORY;
}
