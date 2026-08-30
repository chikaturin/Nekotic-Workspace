"use client";

import { useCallback, useState } from "react";
import { toAppError } from "@/services/errors";
import type { SaveTextResult } from "@/services/file-service";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { FileNode, SaveState } from "@/types";

const IDLE_SAVE: SaveState = {
  status: "idle",
  lastSavedAt: null,
  error: null,
  hasPendingChanges: false,
};

interface DraftState<T> {
  readonly isEditing: boolean;
  readonly baseline: T;
  readonly draft: T;
  readonly save: SaveState;
}

export interface DraftEditor<T> {
  readonly isEditing: boolean;
  readonly draft: T;
  readonly isDirty: boolean;
  readonly saveState: SaveState;
  readonly start: () => void;
  readonly change: (value: T) => void;
  readonly discard: () => void;
  readonly save: (value: T) => Promise<boolean>;
}

interface DraftEditorOptions<T> {
  readonly isEqual?: (a: T, b: T) => boolean;
}

export function useDraftEditor<T>(
  node: FileNode,
  initial: T,
  persist: (node: FileNode, value: T) => Promise<SaveTextResult>,
  options: DraftEditorOptions<T> = {},
): DraftEditor<T> {
  const { isEqual = Object.is } = options;
  const applyFileSave = useWorkspaceStore((store) => store.applyFileSave);
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  const [state, setState] = useState<DraftState<T>>({
    isEditing: false,
    baseline: initial,
    draft: initial,
    save: IDLE_SAVE,
  });

  const start = useCallback(() => {
    setState((current) => ({ ...current, isEditing: true, save: IDLE_SAVE }));
  }, []);

  const change = useCallback(
    (value: T) => {
      setState((current) => ({
        ...current,
        draft: value,
        save: {
          ...current.save,
          status: "idle",
          hasPendingChanges: !isEqual(value, current.baseline),
        },
      }));
    },
    [isEqual],
  );

  const discard = useCallback(() => {
    setState((current) => ({
      ...current,
      isEditing: false,
      draft: current.baseline,
      save: IDLE_SAVE,
    }));
  }, []);

  const save = useCallback(
    async (draft: T) => {
      setState((current) => ({
        ...current,
        save: { ...current.save, status: "saving", error: null },
      }));

      try {
        const result = await persist(node, draft);
        applyFileSave(node.id, result.sizeBytes);

        setState((current) => ({
          ...current,
          isEditing: false,
          baseline: draft,
          save: {
            status: "saved",
            lastSavedAt: result.savedAt,
            error: null,
            hasPendingChanges: !isEqual(current.draft, draft),
          },
        }));

        pushFeedback(`Saved “${node.name}”`, "success");
        return true;
      } catch (error) {
        const appError = toAppError(error);
        setState((current) => ({
          ...current,
          save: {
            status: "error",
            lastSavedAt: current.save.lastSavedAt,
            error: appError.message,
            hasPendingChanges: true,
          },
        }));
        return false;
      }
    },
    [node, persist, applyFileSave, pushFeedback, isEqual],
  );

  return {
    isEditing: state.isEditing,
    draft: state.draft,
    isDirty: !isEqual(state.draft, state.baseline),
    saveState: state.save,
    start,
    change,
    discard,
    save,
  };
}
