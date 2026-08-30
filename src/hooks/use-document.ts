"use client";

import { useCallback, useMemo, useState } from "react";
import { useAutosave } from "@/hooks/use-autosave";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useCapabilities } from "@/hooks/use-permissions";
import { documentCapabilities } from "@/lib/permissions";
import { documentService, summarize } from "@/services/document-service";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  AsyncState,
  Block,
  CapabilitySet,
  DocumentDraft,
  DriveNode,
  SaveState,
  WorkspaceDocument,
} from "@/types";

export interface DocumentController {
  readonly state: AsyncState<WorkspaceDocument>;
  readonly document: WorkspaceDocument | null;
  readonly draft: DocumentDraft | null;
  readonly saveState: SaveState;
  readonly capabilities: CapabilitySet;
  readonly isEditable: boolean;
  readonly setBlocks: (blocks: readonly Block[]) => void;
  readonly setTitle: (title: string) => void;
  readonly setIcon: (icon: string) => void;
  readonly reload: () => void;
  readonly flush: () => void;
  readonly retrySave: () => void;
  readonly applyDocument: (document: WorkspaceDocument) => void;
  readonly applyRestoredDocument: (document: WorkspaceDocument) => void;
}

function toDraft(document: WorkspaceDocument): DocumentDraft {
  return { title: document.title, icon: document.icon, blocks: document.blocks };
}

export function useDocument(nodeId: string, node: DriveNode | null): DocumentController {
  const baseCapabilities = useCapabilities(node);
  const applyDocumentSummary = useWorkspaceStore((state) => state.applyDocumentSummary);

  const loader = useCallback(
    (signal: AbortSignal) => documentService.get(nodeId, signal),
    [nodeId],
  );
  const resource = useAsyncResource(loader);

  const [overlay, setOverlay] = useState<{ nodeId: string; draft: DocumentDraft } | null>(null);

  const document = resource.state.status === "success" ? resource.state.data : null;
  const draft = useMemo(() => {
    if (overlay && overlay.nodeId === nodeId) return overlay.draft;
    return document ? toDraft(document) : null;
  }, [overlay, nodeId, document]);

  const capabilities = useMemo(
    () =>
      document
        ? documentCapabilities(baseCapabilities, document)
        : { ...baseCapabilities, edit: false, upload: false },
    [baseCapabilities, document],
  );

  const isEditable = capabilities.edit;

  const persist = useCallback(
    async (pending: DocumentDraft, signal: AbortSignal) => {
      void signal;

      const saved = await documentService.save(nodeId, pending);
      resource.setData(saved);
      applyDocumentSummary(nodeId, summarize(saved));
    },
    [nodeId, resource, applyDocumentSummary],
  );

  const autosave = useAutosave<DocumentDraft>({
    save: persist,
    enabled: isEditable,
    lastSavedAt: document?.updatedAt ?? null,
  });

  const edit = useCallback(
    (patch: Partial<DocumentDraft>) => {
      if (!draft || !isEditable) return;

      const next: DocumentDraft = { ...draft, ...patch };
      setOverlay({ nodeId, draft: next });
      autosave.schedule(next);
    },
    [draft, isEditable, nodeId, autosave],
  );

  const applyDocument = useCallback(
    (updated: WorkspaceDocument) => {
      resource.setData(updated);
      setOverlay((previous) =>
        previous && previous.nodeId === nodeId
          ? previous
          : { nodeId, draft: toDraft(updated) },
      );
      applyDocumentSummary(nodeId, summarize(updated));
    },
    [resource, nodeId, applyDocumentSummary],
  );

  const applyRestoredDocument = useCallback(
    (updated: WorkspaceDocument) => {
      resource.setData(updated);
      setOverlay({ nodeId, draft: toDraft(updated) });
      applyDocumentSummary(nodeId, summarize(updated));
    },
    [resource, nodeId, applyDocumentSummary],
  );

  const reload = useCallback(() => {
    setOverlay(null);
    resource.reload();
  }, [resource]);

  return {
    state: resource.state,
    document,
    draft,
    saveState: autosave.saveState,
    capabilities,
    isEditable,
    setBlocks: useCallback((blocks: readonly Block[]) => edit({ blocks }), [edit]),
    setTitle: useCallback((title: string) => edit({ title }), [edit]),
    setIcon: useCallback((icon: string) => edit({ icon }), [edit]),
    reload,
    flush: autosave.flush,
    retrySave: autosave.retry,
    applyDocument,
    applyRestoredDocument,
  };
}
