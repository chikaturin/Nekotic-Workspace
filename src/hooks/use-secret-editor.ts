"use client";

import { useCallback, useMemo, useState } from "react";
import {
  isConventionalSecretKey,
  isValidSecretKey,
  parseEnv,
  type EnvEntry,
} from "@/lib/env-file";
import { useEnvironments } from "@/hooks/use-environments";
import { devtoolsService, type SecretDraftEntry } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { SecretDocument, SecretEntry } from "@/types";

export interface SecretDraftRow {
  readonly localId: string;
  readonly id: string | null;
  readonly key: string;
  readonly value: string | null;
  /**
   * Môi trường của secret này.
   *
   * Server BẮT BUỘC có trường này cho một secret MỚI, và trả về
   * `SECRET_ENVIRONMENT_REQUIRED` nếu thiếu. Trước đây ô soạn thảo không mang
   * nó đi đâu cả: `rowsFrom` bỏ giá trị đã lưu, `toDraft` không gửi gì — nên
   * thêm secret mới thì lần nào cũng hỏng, còn sửa secret cũ thì thoát vì
   * server giữ lại giá trị theo `id`.
   */
  readonly environmentOptionId: string;
}

export type PasteMode = "merge" | "replace";

export interface SecretEditor {
  readonly rows: readonly SecretDraftRow[];
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly duplicates: readonly string[];
  readonly invalidKeys: readonly string[];
  readonly unconventionalKeys: readonly string[];
  readonly canSave: boolean;
  readonly setKey: (localId: string, key: string) => void;
  readonly setValue: (localId: string, value: string) => void;
  readonly setEnvironment: (localId: string, environmentOptionId: string) => void;
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
    environmentOptionId: entry.environmentOptionId,
  }));
}

/**
 * Môi trường cho một hàng mới: theo hàng cuối, hoặc môi trường đầu tiên của
 * workspace.
 *
 * KHÔNG dùng hằng số trong `board-templates.ts` — đó là dữ liệu mẫu với id
 * `env_0`, còn server đòi UUID thật từ bảng `environments`.
 */
function nextEnvironment(
  rows: readonly SecretDraftRow[],
  fallback: string | null,
): string {
  return rows.at(-1)?.environmentOptionId ?? fallback ?? "";
}

function toDraft(rows: readonly SecretDraftRow[]): readonly SecretDraftEntry[] {
  return rows.map((row) => ({
    id: row.id,
    key: row.key.trim(),
    environmentOptionId: row.environmentOptionId,
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

export function useSecretEditor(
  document: SecretDocument | null,
  onSaved: (next: SecretDocument) => void,
): SecretEditor {
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);
  const environments = useEnvironments();

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

  const setEnvironment = useCallback(
    (localId: string, environmentOptionId: string) =>
      patch(localId, { environmentOptionId }),
    [patch],
  );

  const remove = useCallback(
    (localId: string) => write(rows.filter((row) => row.localId !== localId)),
    [rows, write],
  );

  const add = useCallback(
    () =>
      write([
        ...rows,
        {
          localId: nextLocalId(),
          id: null,
          key: "",
          value: "",
          environmentOptionId: nextEnvironment(rows, environments.defaultId),
        },
      ]),
    [rows, write, environments.defaultId],
  );

  const applyEnv = useCallback(
    (entries: readonly EnvEntry[], mode: PasteMode) => {
      if (mode === "replace") {
        write(
          entries.map((entry) => {
            const existing = rows.find((row) => row.key.trim() === entry.key);

            return {
              localId: nextLocalId(),
              id: existing?.id ?? null,
              key: entry.key,
              value: entry.value,
              environmentOptionId:
                existing?.environmentOptionId ??
                nextEnvironment(rows, environments.defaultId),
            };
          }),
        );
        return;
      }

      const next = [...rows];
      for (const entry of entries) {
        const at = next.findIndex((row) => row.key.trim() === entry.key);
        if (at === -1) {
          next.push({
            localId: nextLocalId(),
            id: null,
            key: entry.key,
            value: entry.value,
            environmentOptionId: nextEnvironment(next, environments.defaultId),
          });
          continue;
        }
        next[at] = { ...next[at]!, value: entry.value };
      }

      write(next);
    },
    [rows, write, environments.defaultId],
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
      const next = await devtoolsService.saveSecrets({
        nodeId: document.nodeId,
        entries: toDraft(rows),
      });
      onSaved(next);
      setEdited(null);
      pushFeedback("Secrets saved", "success");
      return true;
    } catch (error) {
      pushFeedback(toAppError(error).message, "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [document, rows, onSaved, pushFeedback]);

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
    setEnvironment,
    remove,
    add,
    applyEnv,
    reset,
    save,
  };
}

export { parseEnv };
