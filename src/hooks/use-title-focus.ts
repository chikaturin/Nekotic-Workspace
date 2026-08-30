"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useTitleFocus(
  nodeId: string,
  isEditable: boolean,
): RefObject<HTMLInputElement | null> {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleFocusNodeId = useWorkspaceStore((state) => state.titleFocusNodeId);
  const clearTitleFocus = useWorkspaceStore((state) => state.clearTitleFocus);

  useEffect(() => {
    if (titleFocusNodeId !== nodeId || !isEditable) return;

    const frame = requestAnimationFrame(() => inputRef.current?.select());
    clearTitleFocus();
    return () => cancelAnimationFrame(frame);
  }, [titleFocusNodeId, nodeId, isEditable, clearTitleFocus]);

  return inputRef;
}
