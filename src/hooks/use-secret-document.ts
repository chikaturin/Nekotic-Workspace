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
  /**
   * Hand one plaintext value to the caller so it can be edited.
   *
   * Deliberately separate from `reveal`: this one does not put the value into
   * `revealed`, does not start an auto-hide timer, and does not show it on the
   * read view — the caller owns it for exactly as long as the form it is
   * typing into exists. Null on refusal, which is already reported.
   */
  readonly take: (secretId: string) => Promise<string | null>;
  /**
   * Several at once, as an `.env` block. An empty list means the whole
   * document — "Copy all" and "Copy selected" are the same call.
   */
  readonly copyMany: (secretIds: readonly string[]) => Promise<void>;
  readonly isCopyingMany: boolean;
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

  const take = useCallback(
    async (secretId: string): Promise<string | null> => {
      try {
        return await devtoolsService.revealSecret({ nodeId, secretId, role, action: "reveal" });
      } catch (error) {
        pushFeedback(toAppError(error).message, "error");
        return null;
      }
    },
    [nodeId, role, pushFeedback],
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

  /**
   * Copy a set of secrets without revealing any of them.
   *
   * The values go from the service straight to the clipboard; none of them
   * enters `revealed`, so the screen stays masked throughout. That separation
   * is the point of having a bulk copy at all — the alternative, revealing
   * everything and letting the user select the text, puts a whole credential
   * file on a screen in an office.
   *
   * The service writes one audit entry per key, and neither it nor this
   * records a value.
   */
  const copyMany = useCallback(
    async (secretIds: readonly string[]) => {
      setIsCopyingMany(true);

      try {
        const { text, keys } = await devtoolsService.copySecrets({ nodeId, secretIds, role });
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
    [nodeId, role, pushFeedback],
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
    reload: resource.reload,
  };
}
