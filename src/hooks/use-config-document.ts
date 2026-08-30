"use client";

import { useCallback, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useAutosave } from "@/hooks/use-autosave";
import { lintJson, type JsonProblem } from "@/lib/json-lint";
import { devtoolsService } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, ConfigDocument, ConfigFormat, SaveState } from "@/types";

export const CONFIG_AUTOSAVE_MS = 1_500;

interface ConfigDraft {
  readonly content: string;
}

export interface ConfigController {
  readonly state: AsyncState<ConfigDocument>;
  readonly draft: string;
  readonly problem: JsonProblem | null;
  readonly saveState: SaveState;
  readonly isDirty: boolean;
  readonly setDraft: (value: string) => void;
  readonly save: () => void;
  readonly retry: () => void;
  readonly setFormat: (format: ConfigFormat) => Promise<void>;
  readonly setEnvironment: (optionId: string) => Promise<void>;
  readonly reload: () => void;
  readonly applyDocument: (document: ConfigDocument) => void;
}

export function useConfigDocument(nodeId: string, canEdit = true): ConfigController {
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  const loader = useCallback(
    (signal: AbortSignal) => devtoolsService.getConfig(nodeId, signal),
    [nodeId],
  );

  const resource = useAsyncResource<ConfigDocument>(loader);
  const [draft, setLocalDraft] = useState<string | null>(null);

  const document = resource.state.status === "success" ? resource.state.data : null;
  const content = draft ?? document?.content ?? "";
  const problem = document?.format === "json" ? lintJson(content) : null;

  const { setData } = resource;

  const persist = useCallback(
    async (next: ConfigDraft, signal: AbortSignal) => {
      void signal;

      const saved = await devtoolsService.saveConfig({
        nodeId,
        content: next.content,
        isAutosave: true,
      });
      setData(saved);
    },
    [nodeId, setData],
  );

  const autosave = useAutosave<ConfigDraft>({
    save: persist,
    delayMs: CONFIG_AUTOSAVE_MS,
    enabled: canEdit,
    lastSavedAt: document?.updatedAt ?? null,
  });

  const { schedule } = autosave;

  const setDraft = useCallback(
    (value: string) => {
      setLocalDraft(value);
      schedule({ content: value });
    },
    [schedule],
  );

  const applyDocument = useCallback(
    (next: ConfigDocument) => {
      setData(next);
      setLocalDraft(null);
    },
    [setData],
  );

  const setFormat = useCallback(
    async (format: ConfigFormat) => {
      if (!document || format === document.format) return;

      try {
        setData(await devtoolsService.saveConfig({ nodeId, content, format }));
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      }
    },
    [document, nodeId, content, setData, pushFeedback],
  );

  const setEnvironment = useCallback(
    async (environmentOptionId: string) => {
      if (!document) return;

      try {
        setData(await devtoolsService.saveConfig({ nodeId, content, environmentOptionId }));
        pushFeedback("Environment updated", "success");
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      }
    },
    [document, nodeId, content, setData, pushFeedback],
  );

  return {
    state: resource.state,
    draft: content,
    problem,
    saveState: autosave.saveState,
    isDirty: draft !== null && draft !== document?.content,
    setDraft,
    save: autosave.flush,
    retry: autosave.retry,
    setFormat,
    setEnvironment,
    reload: resource.reload,
    applyDocument,
  };
}
