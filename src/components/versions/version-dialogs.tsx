"use client";

import { useCallback, useMemo } from "react";
import { VersionHistoryDialog } from "@/components/versions/version-history-dialog";
import { useVersionHistory, type VersionSource } from "@/hooks/use-version-history";
import { documentLines } from "@/lib/blocks";
import { configVersionEntry, documentVersionEntry, secretRotationEntries } from "@/lib/versions";
import { devtoolsService } from "@/services/devtools-service";
import { documentService } from "@/services/document-service";
import type { Block, ConfigDocument, SecretDocument, WorkspaceDocument } from "@/types";

/**
 * How each subject maps onto the shared history (SY-VER-39).
 *
 * The dialog, the list and the diff know nothing about pages, config files or
 * secrets — only these three adapters do. That is why a secret can appear in
 * the same surface without any risk of it offering a restore: it simply
 * supplies entries that carry no snapshot.
 */

interface DialogShellProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/* ---------------------------------------------------------------- document */

interface DocumentVersionsProps extends DialogShellProps {
  readonly document: WorkspaceDocument;
  /** The blocks on screen, which may be ahead of the last saved version. */
  readonly blocks: readonly Block[];
  readonly canRestore: boolean;
  readonly onRestored: (document: WorkspaceDocument) => void;
}

export function DocumentVersionsDialog({
  isOpen,
  document,
  blocks,
  canRestore,
  onRestored,
  onClose,
}: DocumentVersionsProps) {
  const nodeId = document.nodeId;

  const load = useCallback(
    (signal: AbortSignal) =>
      documentService.listVersions(nodeId, signal).then((versions) =>
        versions.map(documentVersionEntry),
      ),
    [nodeId],
  );

  const restore = useCallback(
    async (versionId: string) => {
      onRestored(await documentService.restoreVersion(nodeId, versionId));
    },
    [nodeId, onRestored],
  );

  const currentLines = useMemo(() => documentLines(blocks), [blocks]);

  const source = useMemo<VersionSource>(
    () => ({ load, restore, currentLines, currentVersion: document.version, canRestore }),
    [load, restore, currentLines, document.version, canRestore],
  );

  const history = useVersionHistory(source, { enabled: isOpen });

  return (
    <VersionHistoryDialog
      isOpen={isOpen}
      title={document.title}
      history={history}
      onClose={onClose}
    />
  );
}

/* ------------------------------------------------------------------ config */

interface ConfigVersionsProps extends DialogShellProps {
  readonly document: ConfigDocument;
  /** The editor's draft, so a compare reads against unsaved work too. */
  readonly draft: string;
  readonly canRestore: boolean;
  readonly onRestored: (document: ConfigDocument) => void;
}

export function ConfigVersionsDialog({
  isOpen,
  document,
  draft,
  canRestore,
  onRestored,
  onClose,
}: ConfigVersionsProps) {
  const nodeId = document.nodeId;

  const load = useCallback(
    (signal: AbortSignal) =>
      devtoolsService.listConfigVersions(nodeId, signal).then((versions) =>
        versions.map(configVersionEntry),
      ),
    [nodeId],
  );

  const restore = useCallback(
    async (versionId: string) => {
      onRestored(await devtoolsService.restoreConfigVersion(nodeId, versionId));
    },
    [nodeId, onRestored],
  );

  const currentLines = useMemo(() => draft.split("\n"), [draft]);

  const source = useMemo<VersionSource>(
    () => ({ load, restore, currentLines, currentVersion: document.version, canRestore }),
    [load, restore, currentLines, document.version, canRestore],
  );

  const history = useVersionHistory(source, { enabled: isOpen });

  return (
    <VersionHistoryDialog
      isOpen={isOpen}
      title={document.name}
      history={history}
      onClose={onClose}
    />
  );
}

/* ------------------------------------------------------------------ secret */

interface SecretVersionsProps extends DialogShellProps {
  readonly document: SecretDocument;
}

const SECRET_NOTICE =
  "Rotation history only. Secret values are never held by this client, so there is nothing here to compare or restore — reveal a value from the vault instead.";

/**
 * A secret document's history is *when each key was rotated and by whom*. The
 * entries deliberately carry no snapshot: the browser never holds the
 * plaintext, and diffing masks would say nothing true.
 */
export function SecretVersionsDialog({ isOpen, document, onClose }: SecretVersionsProps) {
  const entries = useMemo(() => secretRotationEntries(document), [document]);

  const load = useCallback(() => Promise.resolve(entries), [entries]);

  const source = useMemo<VersionSource>(
    () => ({
      load,
      restore: null,
      currentLines: [],
      currentVersion: entries.length,
      canRestore: false,
    }),
    [load, entries.length],
  );

  const history = useVersionHistory(source, { enabled: isOpen });

  return (
    <VersionHistoryDialog
      isOpen={isOpen}
      title={document.name}
      history={history}
      notice={SECRET_NOTICE}
      onClose={onClose}
    />
  );
}
