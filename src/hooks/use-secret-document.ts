"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useWorkspaceRole } from "@/hooks/use-permissions";
import { devtoolsService } from "@/services/devtools-service";
import { toAppError } from "@/services/errors";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AsyncState, SecretDocument } from "@/types";

/** Revealed values disappear on their own, even if the tab is left open. */
const AUTO_HIDE_MS = 30_000;

export interface SecretController {
  readonly state: AsyncState<SecretDocument>;
  /** Plaintext for secrets revealed in this component, in memory only. */
  readonly revealed: Readonly<Record<string, string>>;
  readonly busyId: string | null;
  readonly reveal: (secretId: string) => Promise<void>;
  readonly hide: (secretId: string) => void;
  readonly copy: (secretId: string) => Promise<void>;
  readonly reload: () => void;
}

/**
 * Secret access.
 *
 * Plaintext lives in component state and nowhere else: it is never written to
 * local or session storage, never put in a cache, and never logged. Each value
 * is fetched from the permission-checked endpoint at the moment it is needed
 * and forgotten again on a timer or on unmount.
 */
export function useSecretDocument(nodeId: string): SecretController {
  const role = useWorkspaceRole();
  const pushFeedback = useWorkspaceStore((store) => store.pushFeedback);

  const loader = useCallback(
    (signal: AbortSignal) => devtoolsService.getSecrets(nodeId, signal),
    [nodeId],
  );

  const resource = useAsyncResource<SecretDocument>(loader);
  const [revealed, setRevealed] = useState<Readonly<Record<string, string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
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

  /** Nothing survives the component: every value is dropped on unmount. */
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
        const value = await devtoolsService.revealSecret({
          nodeId,
          secretId,
          role,
          action: "reveal",
        });

        setRevealed((current) => ({ ...current, [secretId]: value }));

        const timer = window.setTimeout(() => hide(secretId), AUTO_HIDE_MS);
        timers.current.set(secretId, timer);
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setBusyId(null);
      }
    },
    [nodeId, role, hide, pushFeedback],
  );

  const copy = useCallback(
    async (secretId: string) => {
      setBusyId(secretId);

      try {
        // Fetched for this copy alone — the value is not kept afterwards.
        const value = await devtoolsService.revealSecret({
          nodeId,
          secretId,
          role,
          action: "copy",
        });

        await navigator.clipboard.writeText(value);
        pushFeedback("Copied to the clipboard — the value was not stored", "success");
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
      } finally {
        setBusyId(null);
      }
    },
    [nodeId, role, pushFeedback],
  );

  return {
    state: resource.state,
    revealed,
    busyId,
    reveal,
    hide,
    copy,
    reload: resource.reload,
  };
}
