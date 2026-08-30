"use client";

import { useEffect } from "react";
import { SIDEBAR_COLLAPSE_BREAKPOINT } from "@/config/app";
import { useWorkspaceStore } from "@/store/workspace-store";

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
