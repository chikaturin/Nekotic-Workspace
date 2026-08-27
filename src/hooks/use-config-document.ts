"use client";

import { useCallback, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useAutosave } from "@/hooks/use-autosave";
import { lintJson, type JsonProblem } from "@/lib/json-lint";
import { devtoolsService } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, ConfigDocument, ConfigFormat, SaveState } from "@/types";

/**
 * How long typing has to stop before the draft is sent.
 *
 * Longer than the page editor's, on purpose. Code is typed in bursts with real
 * pauses inside them — a half-second gap is the middle of a thought, not the
 * end of an edit — and every save here is a version worth being able to read.
 * The service folds consecutive autosaves into one entry, so this figure is
 * about traffic rather than about history.
 */
export const CONFIG_AUTOSAVE_MS = 1_500;

/** What one debounced save carries. */
interface ConfigDraft {
  readonly content: string;
}

export interface ConfigController {
  readonly state: AsyncState<ConfigDocument>;
  readonly draft: string;
  /** JSON only — nothing else here has a parser worth reporting from. */
  readonly problem: JsonProblem | null;
  readonly saveState: SaveState;
  readonly isDirty: boolean;
  readonly setDraft: (value: string) => void;
  /** Send what is pending now, rather than when the debounce next fires. */
  readonly save: () => void;
  readonly retry: () => void;
  readonly setFormat: (format: ConfigFormat) => Promise<void>;
  readonly setEnvironment: (optionId: string) => Promise<void>;
  readonly reload: () => void;
  readonly applyDocument: (document: ConfigDocument) => void;
}

/**
 * Editing state for a config document.
 *
 * Validation runs on the draft, so an invalid JSON body is flagged while it is
 * being typed rather than on save. Saving runs on the same debounce the page
 * editor uses — the pipeline is `useAutosave`, unchanged — with one difference
 * that matters: a completed autosave updates the loaded document but leaves the
 * local draft alone. Replacing the draft with the server's copy is correct only
 * if nothing was typed while the request was in flight, and on a code surface
 * something usually was; doing it anyway is how an editor eats a sentence.
 */
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
      const saved = await devtoolsService.saveConfig(
        { nodeId, content: next.content, isAutosave: true },
        signal,
      );
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

  /**
   * Changing the language re-colours and re-formats; it never rewrites a byte.
   * The content is sent back exactly as it stands so the language and the text
   * land in one version rather than in two that disagree.
   */
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
