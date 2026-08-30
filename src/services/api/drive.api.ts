import { apiFetch, apiSend } from "@/services/http/client";
import type {
  AccessSubject,
  DriveNode,
  NodeAccessMode,
  TrashEntry,
  WorkspaceRole,
} from "@/types";

export interface CreateNodeInput {
  readonly kind: "project" | "folder" | "document" | "board";
  readonly name: string;
  readonly parentId: string | null;
  readonly documentKind?: string;
  readonly boardKind?: string;
  readonly templateId?: string;
}

export interface NodeCapabilities {
  readonly view: boolean;
  readonly edit: boolean;
  readonly upload: boolean;
  readonly delete: boolean;
  readonly share: boolean;
  readonly manage: boolean;
}

export interface NodeDetail {
  readonly node: DriveNode;
  readonly capabilities: NodeCapabilities;
}

export interface DriveLocation {
  readonly node: DriveNode | null;
  readonly ancestors: readonly DriveNode[];
  readonly children: readonly DriveNode[];
  readonly isNotFound: boolean;
}

export interface AccessOrigin {
  readonly nodeId: string;
  readonly name: string;
}

export interface ResolvedAccess {
  readonly subject:
    | { readonly kind: "user"; readonly userId: string }
    | { readonly kind: "role"; readonly role: WorkspaceRole };
  readonly role: WorkspaceRole;
  readonly source: "workspace" | "inherited" | "explicit" | "override";
  readonly origin: AccessOrigin | null;
  readonly inheritedRole: WorkspaceRole | null;
  readonly inheritedFrom: AccessOrigin | null;
}

export interface NodeAccess {
  readonly nodeId: string;
  readonly accessMode: NodeAccessMode;
  readonly inheritedFrom: AccessOrigin | null;
  readonly entries: readonly ResolvedAccess[];
}

export interface AccessRule {
  readonly id: string;
  readonly nodeId: string;
  readonly subject:
    | { readonly kind: "user"; readonly userId: string }
    | { readonly kind: "role"; readonly role: WorkspaceRole };
  readonly role: WorkspaceRole;
  readonly grantedAt: string;
  readonly grantedBy: string;
}

export const driveApi = {
  tree: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly DriveNode[]>(`/workspaces/${workspaceId}/tree`, {
      signal,
    }),

  resolve: (workspaceId: string, path: string, signal?: AbortSignal) =>
    apiFetch<DriveLocation>(`/workspaces/${workspaceId}/nodes/resolve`, {
      query: { path },
      signal,
    }),

  search: (workspaceId: string, query: string, signal?: AbortSignal) =>
    apiFetch<readonly DriveNode[]>(`/workspaces/${workspaceId}/nodes/search`, {
      query: { q: query },
      signal,
    }),

  get: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<NodeDetail>(`/nodes/${nodeId}`, { signal }),

  children: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<readonly DriveNode[]>(`/nodes/${nodeId}/children`, { signal }),

  capabilities: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<NodeCapabilities>(`/nodes/${nodeId}/capabilities`, { signal }),

  create: (workspaceId: string, input: CreateNodeInput) =>
    apiFetch<DriveNode>(`/workspaces/${workspaceId}/nodes`, {
      method: "POST",
      body: input,
    }),

  update: (nodeId: string, patch: Readonly<Record<string, unknown>>) =>
    apiFetch<DriveNode>(`/nodes/${nodeId}`, { method: "PATCH", body: patch }),

  move: (nodeId: string, parentId: string | null) =>
    apiFetch<DriveNode>(`/nodes/${nodeId}/move`, {
      method: "POST",
      body: { parentId },
    }),

  duplicate: (nodeId: string) =>
    apiFetch<DriveNode>(`/nodes/${nodeId}/duplicate`, { method: "POST" }),

  archive: (nodeId: string, isArchived: boolean) =>
    apiFetch<DriveNode>(`/nodes/${nodeId}/archive`, {
      method: isArchived ? "PUT" : "DELETE",
    }),

  pin: (nodeId: string, isPinned: boolean) =>
    apiSend(`/nodes/${nodeId}/pin`, { method: isPinned ? "PUT" : "DELETE" }),

  favorite: (nodeId: string, isFavorite: boolean) =>
    apiSend(`/nodes/${nodeId}/favorite`, {
      method: isFavorite ? "PUT" : "DELETE",
    }),

  trash: (nodeId: string) => apiSend(`/nodes/${nodeId}`, { method: "DELETE" }),

  listTrash: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly TrashEntry[]>(`/workspaces/${workspaceId}/trash`, {
      signal,
    }),

  restoreTrash: (entryId: string) =>
    apiFetch<DriveNode>(`/trash/${entryId}/restore`, { method: "POST" }),

  purgeTrash: (entryId: string) =>
    apiSend(`/trash/${entryId}`, { method: "DELETE" }),

  emptyTrash: (workspaceId: string) =>
    apiFetch<{ readonly purgedCount: number }>(
      `/workspaces/${workspaceId}/trash`,
      { method: "DELETE" },
    ),

  favorites: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly DriveNode[]>(`/workspaces/${workspaceId}/favorites`, {
      signal,
    }),

  archived: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly DriveNode[]>(`/workspaces/${workspaceId}/archive`, {
      signal,
    }),

  restrictedNodes: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly DriveNode[]>(
      `/workspaces/${workspaceId}/restricted-nodes`,
      { signal },
    ),

  access: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<NodeAccess>(`/nodes/${nodeId}/access`, { signal }),

  setAccessMode: (nodeId: string, mode: NodeAccessMode) =>
    apiFetch<DriveNode>(`/nodes/${nodeId}/access-mode`, {
      method: "PUT",
      body: { accessMode: mode },
    }),

  setAccessRule: (
    nodeId: string,
    subject: AccessSubject,
    role: WorkspaceRole | "none",
  ) =>
    apiFetch<AccessRule>(`/nodes/${nodeId}/access-rules`, {
      method: "PUT",
      body: { subject, role },
    }),

  removeAccessRule: (nodeId: string, ruleId: string) =>
    apiSend(`/nodes/${nodeId}/access-rules/${ruleId}`, { method: "DELETE" }),

  permissionCatalog: (signal?: AbortSignal) =>
    apiFetch<readonly unknown[]>("/permissions/catalog", { signal }),
};
