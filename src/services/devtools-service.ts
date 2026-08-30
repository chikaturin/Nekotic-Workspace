import { devtoolsApi } from "@/services/api/devtools.api";
import type {
  ConfigDocument,
  ConfigFormat,
  SecretAuditEntry,
  SecretDocument,
} from "@/types";

export interface SecretDraftEntry {
  readonly id: string | null;
  readonly key: string;
  readonly value?: string;
  readonly environmentOptionId?: string;
}

export const devtoolsService = {
  getConfig: (nodeId: string, signal?: AbortSignal): Promise<ConfigDocument> =>
    devtoolsApi.config(nodeId, signal),

  createConfig: (input: {
    readonly nodeId: string;
    readonly format: ConfigFormat;
    readonly content?: string;
  }): Promise<ConfigDocument> =>
    devtoolsApi.saveConfig(input.nodeId, {
      content: input.content ?? "",
      format: input.format,
    }),

  saveConfig: (input: {
    readonly nodeId: string;
    readonly content: string;
    readonly format?: ConfigFormat;
    readonly environmentOptionId?: string;
    readonly isAutosave?: boolean;
  }): Promise<ConfigDocument> => {
    const { nodeId, ...body } = input;

    return devtoolsApi.saveConfig(nodeId, body);
  },

  listConfigVersions: (nodeId: string, signal?: AbortSignal) =>
    devtoolsApi.configVersions(nodeId, signal),

  restoreConfigVersion: (nodeId: string, versionId: string) =>
    devtoolsApi.restoreConfigVersion(nodeId, versionId),

  getSecrets: (nodeId: string, signal?: AbortSignal): Promise<SecretDocument> =>
    devtoolsApi.secrets(nodeId, signal),

  revealSecret: async (input: {
    readonly nodeId: string;
    readonly secretId: string;
  }): Promise<string> =>
    (await devtoolsApi.revealSecret(input.nodeId, input.secretId)).value,

  copySecrets: (input: {
    readonly nodeId: string;
    readonly secretIds: readonly string[];
  }) => devtoolsApi.copySecrets(input.nodeId, input.secretIds),

  saveSecrets: (input: {
    readonly nodeId: string;
    readonly entries: readonly SecretDraftEntry[];
  }): Promise<SecretDocument> =>
    devtoolsApi.saveSecrets(input.nodeId, input.entries),

  listSecretAudit: async (
    nodeId: string,
    signal?: AbortSignal,
  ): Promise<readonly SecretAuditEntry[]> =>
    (await devtoolsApi.secretAudit(nodeId, signal)).items,

  environments: (workspaceId: string, signal?: AbortSignal) =>
    devtoolsApi.environments(workspaceId, signal),
};
