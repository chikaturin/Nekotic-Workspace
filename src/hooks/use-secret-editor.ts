"use client";

import { useCallback, useMemo, useState } from "react";
import { useWorkspaceRole } from "@/hooks/use-permissions";
import {
  isConventionalSecretKey,
  isValidSecretKey,
  parseEnv,
  type EnvEntry,
} from "@/lib/env-file";
import { devtoolsService, type SecretDraftEntry } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { SecretDocument, SecretEntry } from "@/types";

/**
 * One row being edited.
 *
 * `value: null` is the load-bearing state: it means *the stored value, which
 * this client has never seen*. A row can be renamed, moved or deleted while
 * its plaintext stays on the server — the editor only ever holds a secret it
 * was explicitly given, by typing or by an audited reveal. Fetching every
 * value into a form the moment someone clicks Edit would put a whole
 * credential file on screen to change one key's name.
 */
export interface SecretDraftRow {
  /** Stable across renames, so React keys a row rather than a key. */
  readonly localId: string;
  /** Server id, or null for a row that does not exist yet. */
  readonly id: string | null;
  readonly key: string;
  readonly value: string | null;
}

export type PasteMode = "merge" | "replace";

export interface SecretEditor {
  readonly rows: readonly SecretDraftRow[];
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  /** Keys typed more than once — reported, never silently collapsed. */
  readonly duplicates: readonly string[];
  /** Keys the store cannot hold at all. */
  readonly invalidKeys: readonly string[];
  /** Keys that will work but do not look like environment variables. */
  readonly unconventionalKeys: readonly string[];
  readonly canSave: boolean;
  readonly setKey: (localId: string, key: string) => void;
  readonly setValue: (localId: string, value: string) => void;
  readonly remove: (localId: string) => void;
  readonly add: () => void;
  readonly applyEnv: (entries: readonly EnvEntry[], mode: PasteMode) => void;
  readonly reset: () => void;
  readonly save: () => Promise<boolean>;
}

let seed = 0;
const nextLocalId = (): string => `srow_${(seed += 1).toString(36)}`;

function rowsFrom(entries: readonly SecretEntry[]): readonly SecretDraftRow[] {
  return entries.map((entry) => ({
    localId: nextLocalId(),
    id: entry.id,
    key: entry.key,
    value: null,
  }));
}

/** The draft as the service wants it: an omitted value means "leave it". */
function toDraft(rows: readonly SecretDraftRow[]): readonly SecretDraftEntry[] {
  return rows.map((row) => ({
    id: row.id,
    key: row.key.trim(),
    ...(row.value === null ? {} : { value: row.value }),
  }));
}

function findDuplicates(rows: readonly SecretDraftRow[]): readonly string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];

  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) continue;
    if (seen.has(key)) {
      if (!repeated.includes(key)) repeated.push(key);
    }
    seen.add(key);
  }

  return repeated;
}

/**
 * Editing state for a secret document.
 *
 * It holds a draft in component memory and nowhere else. Nothing here writes to
 * local or session storage, puts a value in a URL, or logs one — the draft dies
 * with the component, which is the intended behaviour rather than a limitation:
 * a half-typed production credential surviving a tab close is a leak, not a
 * convenience.
 *
 * The reverse is also true, and is why `save` reports failure rather than
 * clearing: a rejected save leaves the draft exactly as it was, so a network
 * error does not cost someone the credential they just pasted in.
 */
export function useSecretEditor(document: SecretDocument | null): SecretEditor {
  const role = useWorkspaceRole();
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  /**
   * Keyed by the document it was opened on, so switching documents falls back
   * to the new one's rows by derivation. No effect re-seeds anything, and a
   * half-typed edit is never clobbered by a background refresh.
   */
  const [edited, setEdited] = useState<{
    nodeId: string;
    rows: readonly SecretDraftRow[];
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const stored = useMemo(() => rowsFrom(document?.entries ?? []), [document]);
  const isEditing = edited !== null && edited.nodeId === document?.nodeId;
  const rows = isEditing ? edited.rows : stored;

  const write = useCallback(
    (next: readonly SecretDraftRow[]) => {
      if (!document) return;
      setEdited({ nodeId: document.nodeId, rows: next });
    },
    [document],
  );

  const patch = useCallback(
    (localId: string, changes: Partial<SecretDraftRow>) => {
      write(rows.map((row) => (row.localId === localId ? { ...row, ...changes } : row)));
    },
    [rows, write],
  );

  const setKey = useCallback(
    (localId: string, key: string) => patch(localId, { key }),
    [patch],
  );

  const setValue = useCallback(
    (localId: string, value: string) => patch(localId, { value }),
    [patch],
  );

  const remove = useCallback(
    (localId: string) => write(rows.filter((row) => row.localId !== localId)),
    [rows, write],
  );

  const add = useCallback(
    () => write([...rows, { localId: nextLocalId(), id: null, key: "", value: "" }]),
    [rows, write],
  );

  /**
   * Fold a pasted `.env` into the draft.
   *
   * Merge updates a key that is already there and appends the rest, which is
   * what pasting a partial file means. Replace is the whole-file case, and is
   * separate rather than inferred because the two differ by whatever the paste
   * *omits* — and silently deleting the keys someone forgot to include is the
   * worst possible reading of an ambiguous gesture.
   */
  const applyEnv = useCallback(
    (entries: readonly EnvEntry[], mode: PasteMode) => {
      if (mode === "replace") {
        write(
          entries.map((entry) => ({
            localId: nextLocalId(),
            id: rows.find((row) => row.key.trim() === entry.key)?.id ?? null,
            key: entry.key,
            value: entry.value,
          })),
        );
        return;
      }

      const next = [...rows];
      for (const entry of entries) {
        const at = next.findIndex((row) => row.key.trim() === entry.key);
        if (at === -1) {
          next.push({ localId: nextLocalId(), id: null, key: entry.key, value: entry.value });
          continue;
        }
        next[at] = { ...next[at]!, value: entry.value };
      }

      write(next);
    },
    [rows, write],
  );

  const reset = useCallback(() => setEdited(null), []);

  const duplicates = useMemo(() => findDuplicates(rows), [rows]);

  const invalidKeys = useMemo(
    () => rows.map((row) => row.key).filter((key) => !isValidSecretKey(key)),
    [rows],
  );

  const unconventionalKeys = useMemo(
    () =>
      rows
        .map((row) => row.key.trim())
        .filter((key) => isValidSecretKey(key) && !isConventionalSecretKey(key)),
    [rows],
  );

  const isDirty = isEditing;

  const save = useCallback(async (): Promise<boolean> => {
    if (!document) return false;

    setIsSaving(true);
    try {
      await devtoolsService.saveSecrets({
        nodeId: document.nodeId,
        entries: toDraft(rows),
        role,
      });
      setEdited(null);
      pushFeedback("Secrets saved", "success");
      return true;
    } catch (error) {
      // The draft survives on purpose — a failed save must not cost the user
      // the credential they just typed in.
      pushFeedback(toAppError(error).message, "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [document, rows, role, pushFeedback]);

  return {
    rows,
    isDirty,
    isSaving,
    duplicates,
    invalidKeys,
    unconventionalKeys,
    canSave: isDirty && duplicates.length === 0 && invalidKeys.length === 0 && rows.length > 0,
    setKey,
    setValue,
    remove,
    add,
    applyEnv,
    reset,
    save,
  };
}

export { parseEnv };
