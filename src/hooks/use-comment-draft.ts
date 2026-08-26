"use client";

import { useCallback, useState } from "react";

const KEY_PREFIX = "nexdrop-comment-draft:";

function storageKey(rowId: string): string {
  return `${KEY_PREFIX}${rowId}`;
}

function readDraft(rowId: string): string {
  try {
    return window.localStorage.getItem(storageKey(rowId)) ?? "";
  } catch {
    // Private mode or blocked storage — the composer just starts empty.
    return "";
  }
}

/**
 * Comment drafts survive closing the drawer, per row.
 *
 * The PRD asks for exactly this: an unsent comment must not be lost when the
 * drawer closes. Storage is per viewer and best-effort, so every access is
 * guarded.
 */
export function useCommentDraft(rowId: string): {
  draft: string;
  setDraft: (value: string) => void;
  clearDraft: () => void;
} {
  const [draft, setLocalDraft] = useState(() => readDraft(rowId));

  const setDraft = useCallback(
    (value: string) => {
      setLocalDraft(value);

      try {
        if (value.trim().length === 0) window.localStorage.removeItem(storageKey(rowId));
        else window.localStorage.setItem(storageKey(rowId), value);
      } catch {
        /* storage unavailable — the draft still lives in component state */
      }
    },
    [rowId],
  );

  const clearDraft = useCallback(() => setDraft(""), [setDraft]);

  return { draft, setDraft, clearDraft };
}
