"use client";

import { useCallback, useMemo } from "react";
import { VersionHistoryDialog } from "@/components/versions/version-history-dialog";
import { useVersionHistory, type VersionSource } from "@/hooks/use-version-history";
import { documentLines } from "@/lib/blocks";
import { configVersionEntry, secretRotationEntries } from "@/lib/versions";
import { devtoolsService } from "@/services/devtools-service";
import { documentService } from "@/services/document-service";
import type { Block, ConfigDocument, SecretDocument, WorkspaceDocument } from "@/types";

interface DialogShellProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface DocumentVersionsProps extends DialogShellProps {
  readonly document: WorkspaceDocument;
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
    (signal: AbortSignal) => documentService.listVersions(nodeId, signal),
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

interface ConfigVersionsProps extends DialogShellProps {
  readonly document: ConfigDocument;
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

interface SecretVersionsProps extends DialogShellProps {
  readonly document: SecretDocument;
}

const SECRET_NOTICE =
  "Rotation history only. Secret values are never held by this client, so there is nothing here to compare or restore — reveal a value from the vault instead.";

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
