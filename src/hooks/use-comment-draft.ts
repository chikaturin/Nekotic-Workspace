"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY_PREFIX = "nekotic-comment-draft:";

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
  }

  for (const listener of listeners) listener();
}

export function peekCommentDraft(draftKey: string): string {
  return snapshot(draftKey);
}

export interface CommentDraft {
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  readonly clearDraft: () => void;
}

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
