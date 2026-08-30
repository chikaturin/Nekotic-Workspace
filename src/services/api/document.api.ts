import { apiFetch } from "@/services/http/client";
import type { Block, VersionEntry, WorkspaceDocument } from "@/types";

export interface VersionPage {
  readonly items: readonly VersionEntry[];
  readonly nextCursor: string | null;
}

export interface DocumentDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

export const documentApi = {
  get: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<WorkspaceDocument>(`/nodes/${nodeId}/document`, { signal }),

  save: (
    nodeId: string,
    draft: {
      readonly title: string;
      readonly icon: string;
      readonly blocks: readonly Block[];
      readonly expectedVersion?: number;
    },
  ) =>
    apiFetch<WorkspaceDocument>(`/nodes/${nodeId}/document`, {
      method: "PUT",
      body: draft,
    }),

  pin: (nodeId: string, isPinned: boolean) =>
    apiFetch<WorkspaceDocument>(`/nodes/${nodeId}/document/pin`, {
      method: isPinned ? "PUT" : "DELETE",
    }),

  lock: (nodeId: string, isLocked: boolean) =>
    apiFetch<WorkspaceDocument>(`/nodes/${nodeId}/document/lock`, {
      method: isLocked ? "PUT" : "DELETE",
    }),

  versions: (nodeId: string, cursor?: string, signal?: AbortSignal) =>
    apiFetch<VersionPage>(`/nodes/${nodeId}/versions`, {
      query: { cursor },
      signal,
    }),

  version: (nodeId: string, versionId: string, signal?: AbortSignal) =>
    apiFetch<WorkspaceDocument>(`/nodes/${nodeId}/versions/${versionId}`, {
      signal,
    }),

  diff: (nodeId: string, versionId: string, signal?: AbortSignal) =>
    apiFetch<DocumentDiff>(`/nodes/${nodeId}/versions/${versionId}/diff`, {
      signal,
    }),

  restoreVersion: (nodeId: string, versionId: string) =>
    apiFetch<WorkspaceDocument>(
      `/nodes/${nodeId}/versions/${versionId}/restore`,
      { method: "POST" },
    ),
};
