"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { routableHref } from "@/lib/exported-routes";

/**
 * Navigate to a node without leaving the app.
 *
 * A node the static export knows about keeps its clean URL. One it does not —
 * anything created, renamed or moved since the build — is opened through the
 * prerendered section root instead, so the navigation stays a soft one. A hard
 * one would reload the workspace and discard the very record being opened.
 */
export function useOpenNode(): (href: string) => void {
  const router = useRouter();

  return useCallback((href: string) => router.push(routableHref(href)), [router]);
}
