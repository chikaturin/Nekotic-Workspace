"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY_PREFIX = "nexdrop-comment-draft:";

/**
 * Unsent comments, kept per composer.
 *
 * The PRD asks for exactly this: closing the drawer must not lose what you
 * were typing. Drafts are read through an external store rather than component
 * state, so switching to another record swaps the draft without a syncing
 * effect, and a viewer whose storage is blocked still gets a working composer
 * from the in-memory half.
 */

/** Authoritative in-session copy; local storage is the persistence layer. */
const drafts = new Map<string, string>();
const listeners = new Set<() => void>();

function storageKey(draftKey: string): string {
  return `${KEY_PREFIX}${draftKey}`;
}

function snapshot(draftKey: string): string {
  const cached = drafts.get(draftKey);
  if (cached !== undefined) return cached;

  let stored = "";
  try {
    stored = window.localStorage.getItem(storageKey(draftKey)) ?? "";
  } catch {
    /* private mode or blocked storage — the composer starts empty */
  }

  drafts.set(draftKey, stored);
  return stored;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function writeDraft(draftKey: string, value: string): void {
  drafts.set(draftKey, value);

  try {
    if (value.trim().length === 0) window.localStorage.removeItem(storageKey(draftKey));
    else window.localStorage.setItem(storageKey(draftKey), value);
  } catch {
    /* the draft still lives in the in-memory map for this session */
  }

  for (const listener of listeners) listener();
}

/** Current value of a draft, outside React — used to clear only what was sent. */
export function peekCommentDraft(draftKey: string): string {
  return snapshot(draftKey);
}

export interface CommentDraft {
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  readonly clearDraft: () => void;
}

/**
 * `draftKey` is the target key, plus the root id for a reply composer, so a
 * half-written reply never overwrites a half-written top-level comment.
 */
export function useCommentDraft(draftKey: string): CommentDraft {
  const draft = useSyncExternalStore(
    subscribe,
    () => snapshot(draftKey),
    () => "",
  );

  const setDraft = useCallback((value: string) => writeDraft(draftKey, value), [draftKey]);
  const clearDraft = useCallback(() => writeDraft(draftKey, ""), [draftKey]);

  return { draft, setDraft, clearDraft };
}
