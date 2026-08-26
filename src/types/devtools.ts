import type { UserSummary } from "./user";

/* ------------------------------------------------------------------ config */

export type ConfigFormat = "json" | "env" | "yaml";

export interface ConfigDocument {
  readonly nodeId: string;
  readonly name: string;
  readonly format: ConfigFormat;
  /** Option id from the shared environment list (DV-ENV-21). */
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
  /** `+3 −1 lines` — enough to scan the history without diffing. */
  readonly summary: string;
}

/* ------------------------------------------------------------------ secret */

/**
 * What the client is allowed to hold. There is no `value` here on purpose:
 * plaintext only ever arrives from an explicit, permission-checked reveal, and
 * it is never written back into this shape.
 */
export interface SecretEntry {
  readonly id: string;
  readonly key: string;
  /** Fixed-width mask; never derived from the real value's length. */
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

export type SecretAction = "reveal" | "copy";

export interface SecretAuditEntry {
  readonly id: string;
  readonly action: SecretAction;
  readonly secretId: string;
  readonly key: string;
  readonly actor: UserSummary;
  readonly at: string;
  /** Recorded by the server — the client never sources this. */
  readonly ip: string;
}
