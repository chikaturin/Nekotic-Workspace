"use client";

import { useEffect } from "react";
import { SIDEBAR_COLLAPSE_BREAKPOINT } from "@/config/app";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Collapse the rail when there is no room for it.
 *
 * The rail takes 276px of layout width, which on a narrow viewport leaves the
 * content pane too thin to read. It collapses to its icon width below the
 * breakpoint and expands again above it; a manual toggle stands until the next
 * crossing, because the listener only fires when the answer changes.
 */
export function useResponsiveSidebar(): void {
  const setSidebarCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SIDEBAR_COLLAPSE_BREAKPOINT - 1}px)`);
    if (query.matches) setSidebarCollapsed(true);

    const onChange = (event: MediaQueryListEvent) => setSidebarCollapsed(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [setSidebarCollapsed]);
}
