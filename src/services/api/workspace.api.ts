import { apiFetch, apiSend } from "@/services/http/client";
import type {
  DirectoryUser,
  StorageQuota,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types";

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly role: WorkspaceRole;
  readonly invitedAt: string;
  readonly expiresAt: string;
}

export const workspaceApi = {
  list: (signal?: AbortSignal) =>
    apiFetch<readonly Workspace[]>("/workspaces", { signal }),

  get: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<Workspace>(`/workspaces/${workspaceId}`, { signal }),

  create: (input: { readonly name: string; readonly description?: string }) =>
    apiFetch<Workspace>("/workspaces", { method: "POST", body: input }),

  update: (workspaceId: string, patch: Readonly<Record<string, unknown>>) =>
    apiFetch<Workspace>(`/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: patch,
    }),

  remove: (workspaceId: string) =>
    apiSend(`/workspaces/${workspaceId}`, { method: "DELETE" }),

  directory: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly DirectoryUser[]>(`/workspaces/${workspaceId}/directory`, {
      signal,
    }),

  members: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly WorkspaceMember[]>(`/workspaces/${workspaceId}/members`, {
      signal,
    }),

  invite: (workspaceId: string, email: string, role: WorkspaceRole) =>
    apiFetch<InvitationView>(`/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: { email, role },
    }),

  createMemberAccount: (
    workspaceId: string,
    input: {
      readonly email: string;
      readonly name: string;
      readonly password: string;
      readonly role: WorkspaceRole;
    },
  ) =>
    apiFetch<WorkspaceMember>(`/workspaces/${workspaceId}/members/accounts`, {
      method: "POST",
      body: input,
    }),

  changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
    apiFetch<WorkspaceMember>(
      `/workspaces/${workspaceId}/members/${userId}`,
      { method: "PATCH", body: { role } },
    ),

  removeMember: (workspaceId: string, userId: string) =>
    apiSend(`/workspaces/${workspaceId}/members/${userId}`, {
      method: "DELETE",
    }),

  leave: (workspaceId: string) =>
    apiSend(`/workspaces/${workspaceId}/members/me`, { method: "DELETE" }),

  invitations: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly InvitationView[]>(
      `/workspaces/${workspaceId}/invitations`,
      { signal },
    ),

  acceptInvitation: (token: string) =>
    apiFetch<Workspace>(`/invitations/${token}/accept`, { method: "POST" }),

  storage: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<StorageQuota>(`/workspaces/${workspaceId}/storage`, { signal }),
};
