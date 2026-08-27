import type { UserSummary } from "./user";

/* ------------------------------------------------------------------ config */

/**
 * The languages a config document can be written in.
 *
 * A "config document" was never only an `.env` file. The thing people keep in
 * one is whatever their service reads at boot — a JSON block, a compose file, a
 * TypeScript constants module, an nginx server block — and forcing all of it
 * through one dialect's highlighter made every document but one look wrong.
 *
 * The list is deliberately short and deliberately not extensible from data: it
 * is a union, so a document cannot be saved in a language nothing can colour,
 * and every branch that switches on it is checked exhaustively at build time.
 * Hundreds of languages is a different product; this is the set a backend team
 * actually keeps beside its services.
 *
 * `format` rather than `language` on the wire: it is what the field has always
 * been called and what the stored documents carry. The UI says "Language".
 */
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
  /**
   * Written by the debounce rather than by a person pressing Save. The next
   * autosave by the same author rewrites this entry instead of adding one.
   */
  readonly isAutosave?: boolean;
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

/**
 * What was done to a secret, as the audit trail records it.
 *
 * `reveal` and `copy` are both reads of plaintext and are kept apart because
 * they carry different risk: one puts a value on a screen for thirty seconds,
 * the other puts it on a clipboard indefinitely. `rotate` is the write.
 */
export type SecretAction = "reveal" | "copy" | "rotate";

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
