"use client";

import { useEffect } from "react";

/**
 * Ask the browser to confirm before leaving with unsaved work.
 *
 * Losing an edit on navigation is worse than an extra browser prompt, and the
 * prompt is the only thing that can interrupt a tab close. Registered only
 * while there is actually something to lose, so a clean page never asks.
 */
export function useUnsavedWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
}
