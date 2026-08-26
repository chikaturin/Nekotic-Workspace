"use client";

import { useCallback, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { lintJson, type JsonProblem } from "@/lib/json-lint";
import { devtoolsService } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, ConfigDocument, SaveState } from "@/types";

const IDLE_SAVE: SaveState = {
  status: "idle",
  lastSavedAt: null,
  error: null,
  hasPendingChanges: false,
};

export interface ConfigController {
  readonly state: AsyncState<ConfigDocument>;
  readonly draft: string;
  readonly problem: JsonProblem | null;
  readonly saveState: SaveState;
  readonly isDirty: boolean;
  readonly setDraft: (value: string) => void;
  readonly save: () => Promise<void>;
  readonly setEnvironment: (optionId: string) => Promise<void>;
  readonly reload: () => void;
  readonly applyDocument: (document: ConfigDocument) => void;
}

/**
 * Editing state for a config document. Validation runs on the draft, so an
 * invalid JSON body is flagged while it is being typed rather than on save.
 */
export function useConfigDocument(nodeId: string): ConfigController {
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  const loader = useCallback(
    (signal: AbortSignal) => devtoolsService.getConfig(nodeId, signal),
    [nodeId],
  );

  const resource = useAsyncResource<ConfigDocument>(loader);
  const [draft, setLocalDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(IDLE_SAVE);

  const document = resource.state.status === "success" ? resource.state.data : null;
  const content = draft ?? document?.content ?? "";
  const problem = document?.format === "json" ? lintJson(content) : null;

  const setDraft = useCallback((value: string) => {
    setLocalDraft(value);
    setSaveState((current) => ({ ...current, status: "idle", hasPendingChanges: true }));
  }, []);

  const applyDocument = useCallback(
    (next: ConfigDocument) => {
      resource.setData(next);
      setLocalDraft(null);
      setSaveState({
        status: "saved",
        lastSavedAt: next.updatedAt,
        error: null,
        hasPendingChanges: false,
      });
    },
    [resource],
  );

  const save = useCallback(async () => {
    if (!document) return;

    setSaveState((current) => ({ ...current, status: "saving", error: null }));

    try {
      const next = await devtoolsService.saveConfig({ nodeId, content });
      applyDocument(next);
    } catch (error) {
      const appError = toAppError(error);
      setSaveState({
        status: "error",
        lastSavedAt: null,
        error: appError.message,
        hasPendingChanges: true,
      });
      pushFeedback(appError.message, "error");
    }
  }, [document, nodeId, content, applyDocument, pushFeedback]);

  const setEnvironment = useCallback(
    async (environmentOptionId: string) => {
      if (!document) return;

      try {
        const next = await devtoolsService.saveConfig({
          nodeId,
          content,
          environmentOptionId,
        });
        applyDocument(next);
        pushFeedback("Environment updated", "success");
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      }
    },
    [document, nodeId, content, applyDocument, pushFeedback],
  );

  return {
    state: resource.state,
    draft: content,
    problem,
    saveState,
    isDirty: draft !== null && draft !== document?.content,
    setDraft,
    save,
    setEnvironment,
    reload: resource.reload,
    applyDocument,
  };
}
