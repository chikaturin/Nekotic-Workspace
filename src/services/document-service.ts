import { documentExcerpt } from "@/lib/blocks";
import { documentApi } from "@/services/api/document.api";
import { driveApi } from "@/services/api/drive.api";
import type { DocumentDraft, VersionEntry, WorkspaceDocument } from "@/types";

export interface DocumentSummaryPatch {
  readonly name: string;
  readonly icon: string;
  readonly blockCount: number;
  readonly excerpt: string;
  readonly isPinned: boolean;
  readonly isLocked: boolean;
  readonly isArchived: boolean;
  readonly updatedAt: string;
}

export function summarize(document: WorkspaceDocument): DocumentSummaryPatch {
  return {
    name: document.title,
    icon: document.icon,
    blockCount: document.blocks.length,
    excerpt: documentExcerpt(document.blocks, 120),
    isPinned: document.isPinned,
    isLocked: document.isLocked,
    isArchived: document.isArchived,
    updatedAt: document.updatedAt,
  };
}

export const documentService = {
  get: (nodeId: string, signal?: AbortSignal) =>
    documentApi.get(nodeId, signal),

  save: (nodeId: string, draft: DocumentDraft, expectedVersion?: number) =>
    documentApi.save(nodeId, {
      title: draft.title.trim().length > 0 ? draft.title : "Untitled",
      icon: draft.icon,
      blocks: draft.blocks,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    }),

  create: (input: {
    readonly nodeId: string;
    readonly title: string;
    readonly icon: string;
    readonly blocks: readonly WorkspaceDocument["blocks"][number][];
  }) =>
    documentApi.save(input.nodeId, {
      title: input.title,
      icon: input.icon,
      blocks: input.blocks,
    }),

  setPinned: (nodeId: string, isPinned: boolean) =>
    documentApi.pin(nodeId, isPinned),

  setLocked: (nodeId: string, isLocked: boolean) =>
    documentApi.lock(nodeId, isLocked),

  setArchived: (nodeId: string, isArchived: boolean) =>
    driveApi.archive(nodeId, isArchived),

  duplicate: (nodeId: string) => driveApi.duplicate(nodeId),

  remove: (nodeId: string) => driveApi.trash(nodeId),

  listVersions: async (
    nodeId: string,
    signal?: AbortSignal,
  ): Promise<readonly VersionEntry[]> =>
    (await documentApi.versions(nodeId, undefined, signal)).items,

  getVersion: (nodeId: string, versionId: string, signal?: AbortSignal) =>
    documentApi.version(nodeId, versionId, signal),

  diffVersion: (nodeId: string, versionId: string, signal?: AbortSignal) =>
    documentApi.diff(nodeId, versionId, signal),

  restoreVersion: (nodeId: string, versionId: string) =>
    documentApi.restoreVersion(nodeId, versionId),
};
