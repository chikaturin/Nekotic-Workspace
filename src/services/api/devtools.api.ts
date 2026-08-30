import { apiFetch, apiSend } from "@/services/http/client";
import type {
  ConfigDocument,
  ConfigFormat,
  ConfigVersion,
  SecretAuditEntry,
  SecretDocument,
} from "@/types";

export interface Environment {
  readonly id: string;
  readonly workspaceId: string;
  readonly label: string;
  readonly color: string;
  readonly position: number;
}

export interface SecretAuditPage {
  readonly items: readonly SecretAuditEntry[];
  readonly nextCursor: string | null;
}

export const devtoolsApi = {
  config: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<ConfigDocument>(`/nodes/${nodeId}/config`, { signal }),

  saveConfig: (
    nodeId: string,
    body: {
      readonly content: string;
      readonly format?: ConfigFormat;
      readonly environmentOptionId?: string;
      readonly isAutosave?: boolean;
    },
  ) =>
    apiFetch<ConfigDocument>(`/nodes/${nodeId}/config`, {
      method: "PUT",
      body,
    }),

  configVersions: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<readonly ConfigVersion[]>(`/nodes/${nodeId}/config/versions`, {
      signal,
    }),

  restoreConfigVersion: (nodeId: string, versionId: string) =>
    apiFetch<ConfigDocument>(
      `/nodes/${nodeId}/config/versions/${versionId}/restore`,
      { method: "POST" },
    ),

  secrets: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<SecretDocument>(`/nodes/${nodeId}/secrets`, { signal }),

  saveSecrets: (nodeId: string, entries: readonly unknown[]) =>
    apiFetch<SecretDocument>(`/nodes/${nodeId}/secrets`, {
      method: "PUT",
      body: { entries },
    }),

  revealSecret: (nodeId: string, secretId: string) =>
    apiFetch<{ readonly value: string }>(
      `/nodes/${nodeId}/secrets/${secretId}/reveal`,
      { method: "POST" },
    ),

  copySecrets: (nodeId: string, secretIds: readonly string[]) =>
    apiFetch<{ readonly text: string; readonly keys: readonly string[] }>(
      `/nodes/${nodeId}/secrets/copy`,
      { method: "POST", body: { secretIds } },
    ),

  secretAudit: (nodeId: string, signal?: AbortSignal) =>
    apiFetch<SecretAuditPage>(`/nodes/${nodeId}/secrets/audit`, {
      signal,
    }),

  environments: (workspaceId: string, signal?: AbortSignal) =>
    apiFetch<readonly Environment[]>(
      `/workspaces/${workspaceId}/environments`,
      { signal },
    ),

  createEnvironment: (
    workspaceId: string,
    input: {
      readonly label: string;
      readonly color: string;
      readonly position?: number;
    },
  ) =>
    apiFetch<Environment>(`/workspaces/${workspaceId}/environments`, {
      method: "POST",
      body: input,
    }),

  updateEnvironment: (
    environmentId: string,
    patch: Readonly<Record<string, unknown>>,
  ) =>
    apiFetch<Environment>(`/environments/${environmentId}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteEnvironment: (environmentId: string) =>
    apiSend(`/environments/${environmentId}`, { method: "DELETE" }),
};
