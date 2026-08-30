"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { devtoolsService } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, SecretDocument } from "@/types";

const AUTO_HIDE_MS = 30_000;

export interface SecretController {
  readonly state: AsyncState<SecretDocument>;
  readonly revealed: Readonly<Record<string, string>>;
  readonly busyId: string | null;
  readonly reveal: (secretId: string) => Promise<void>;
  readonly hide: (secretId: string) => void;
  readonly copy: (secretId: string) => Promise<void>;
  readonly take: (secretId: string) => Promise<string | null>;
  readonly copyMany: (secretIds: readonly string[]) => Promise<void>;
  readonly isCopyingMany: boolean;
  readonly apply: (next: SecretDocument) => void;
  readonly reload: () => void;
}

export function useSecretDocument(nodeId: string): SecretController {
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  const loader = useCallback(
    (signal: AbortSignal) => devtoolsService.getSecrets(nodeId, signal),
    [nodeId],
  );

  const resource = useAsyncResource<SecretDocument>(loader);
  const [revealed, setRevealed] = useState<Readonly<Record<string, string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCopyingMany, setIsCopyingMany] = useState(false);
  const timers = useRef(new Map<string, number>());

  const hide = useCallback((secretId: string) => {
    setRevealed((current) => {
      if (!(secretId in current)) return current;

      const next = { ...current };
      delete next[secretId];
      return next;
    });

    const timer = timers.current.get(secretId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(secretId);
    }
  }, []);

  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const reveal = useCallback(
    async (secretId: string) => {
      setBusyId(secretId);

      try {
        const value = await devtoolsService.revealSecret({ nodeId, secretId });

        setRevealed((current) => ({ ...current, [secretId]: value }));

        const timer = window.setTimeout(() => hide(secretId), AUTO_HIDE_MS);
        timers.current.set(secretId, timer);
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setBusyId(null);
      }
    },
    [nodeId, hide, pushFeedback],
  );

  const take = useCallback(
    async (secretId: string): Promise<string | null> => {
      try {
        return await devtoolsService.revealSecret({ nodeId, secretId });
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
        return null;
      }
    },
    [nodeId, pushFeedback],
  );

  const copy = useCallback(
    async (secretId: string) => {
      setBusyId(secretId);

      try {
        const value = await devtoolsService.revealSecret({ nodeId, secretId });

        await navigator.clipboard.writeText(value);
        pushFeedback("Copied to the clipboard — the value was not stored", "success");
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setBusyId(null);
      }
    },
    [nodeId, pushFeedback],
  );

  const apply = useCallback(
    (next: SecretDocument) => {
      resource.setData(next);
      setRevealed({});
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [resource],
  );

  const copyMany = useCallback(
    async (secretIds: readonly string[]) => {
      setIsCopyingMany(true);

      try {
        const { text, keys } = await devtoolsService.copySecrets({ nodeId, secretIds });
        await navigator.clipboard.writeText(text);
        pushFeedback(
          `Copied ${keys.length} secret${keys.length === 1 ? "" : "s"} — the values were not stored`,
          "success",
        );
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setIsCopyingMany(false);
      }
    },
    [nodeId, pushFeedback],
  );

  return {
    state: resource.state,
    revealed,
    busyId,
    reveal,
    hide,
    take,
    copy,
    copyMany,
    isCopyingMany,
    apply,
    reload: resource.reload,
  };
}
