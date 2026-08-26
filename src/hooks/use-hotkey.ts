"use client";

import { useEffect } from "react";

interface HotkeyOptions {
  /** Fire even while focus is inside an input or textarea. */
  readonly enableInInputs?: boolean;
  readonly enabled?: boolean;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * Bind a keyboard shortcut such as `mod+k`, `mod+b` or `escape`.
 * `mod` maps to ⌘ on macOS and Ctrl elsewhere.
 */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
): void {
  const { enableInInputs = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1] ?? "";
    const needsMod = parts.includes("mod");
    const needsShift = parts.includes("shift");
    const needsAlt = parts.includes("alt");

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key) return;
      if (needsMod !== (event.metaKey || event.ctrlKey)) return;
      if (needsShift !== event.shiftKey) return;
      if (needsAlt !== event.altKey) return;
      if (!enableInInputs && isEditableTarget(event.target)) return;

      event.preventDefault();
      handler(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler, enableInInputs, enabled]);
}
