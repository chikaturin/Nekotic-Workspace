"use client";

import { useEffect } from "react";

interface HotkeyOptions {
  readonly enableInInputs?: boolean;
  readonly enabled?: boolean;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

export interface HotkeyChord {
  readonly key: string;
  readonly needsMod: boolean;
  readonly needsShift: boolean;
  readonly needsAlt: boolean;
}

export function parseHotkey(combo: string): HotkeyChord {
  const parts = combo.toLowerCase().split("+");

  return {
    key: parts[parts.length - 1] ?? "",
    needsMod: parts.includes("mod"),
    needsShift: parts.includes("shift"),
    needsAlt: parts.includes("alt"),
  };
}

export interface KeyStroke {
  readonly key?: string | null;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

export function matchesHotkey(chord: HotkeyChord, stroke: KeyStroke): boolean {
  if (typeof stroke.key !== "string" || stroke.key.length === 0) return false;

  if (stroke.key.toLowerCase() !== chord.key) return false;
  if (chord.needsMod !== (stroke.metaKey === true || stroke.ctrlKey === true)) return false;
  if (chord.needsShift !== (stroke.shiftKey === true)) return false;

  return chord.needsAlt === (stroke.altKey === true);
}

export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
): void {
  const { enableInInputs = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const chord = parseHotkey(combo);

    function onKeyDown(event: KeyboardEvent) {
      if (!matchesHotkey(chord, event)) return;
      if (!enableInInputs && isEditableTarget(event.target)) return;

      event.preventDefault();
      handler(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler, enableInInputs, enabled]);
}
