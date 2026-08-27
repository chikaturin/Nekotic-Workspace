"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * A freshly created item opens with its name selected.
 *
 * Creating is the first half of naming: every "new…" in the app makes the node
 * and then asks for its title, so typing a name is the next thing that happens
 * rather than a separate Rename to go and find. The request is consumed once —
 * coming back to the item later must not steal focus from whatever you came
 * back to do.
 *
 * The ref goes on the input the request is *about*. A surface that requests
 * focus and has nowhere to put it leaves "Untitled config" on screen with no
 * hint that the name was ever editable, which is exactly what the config and
 * secret documents did before they had one.
 */
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
