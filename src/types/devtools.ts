import type { UserSummary } from "./user";

export type ConfigFormat =
  | "json"
  | "env"
  | "yaml"
  | "javascript"
  | "typescript"
  | "jsx"
  | "tsx"
  | "html"
  | "xml"
  | "css"
  | "sql"
  | "shell"
  | "dockerfile"
  | "nginx"
  | "text";

export interface ConfigDocument {
  readonly nodeId: string;
  readonly name: string;
  readonly format: ConfigFormat;
  readonly environmentOptionId: string;
  readonly content: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly updatedBy: UserSummary;
}

export interface ConfigVersion {
  readonly id: string;
  readonly version: number;
  readonly content: string;
  readonly createdAt: string;
  readonly author: UserSummary;
  readonly summary: string;
  readonly isAutosave?: boolean;
}

export interface SecretEntry {
  readonly id: string;
  readonly key: string;
  readonly maskedValue: string;
  readonly environmentOptionId: string;
  readonly updatedAt: string;
  readonly rotatedBy: UserSummary;
  readonly note?: string;
}

export interface SecretDocument {
  readonly nodeId: string;
  readonly name: string;
  readonly entries: readonly SecretEntry[];
}

export type SecretAction = "reveal" | "copy" | "rotate";

export interface SecretAuditEntry {
  readonly id: string;
  readonly action: SecretAction;
  readonly secretId: string;
  readonly key: string;
  readonly actor: UserSummary;
  readonly at: string;
  readonly ip: string;
}
