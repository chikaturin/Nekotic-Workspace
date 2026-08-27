import { ENVIRONMENT_OPTIONS } from "@/lib/board-templates";
import { isValidSecretKey, toEnvText, type EnvEntry } from "@/lib/env-file";
import { roleHas } from "@/lib/permissions/roles";
import { formatFromName } from "@/lib/syntax";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER, DIRECTORY, memberAt } from "@/mock/users";
import { CONFIG_SEEDS, SECRET_SEEDS } from "@/mock/devtools";
import { nextId, nowIso, readDelay, writeDelay } from "@/services/backend";
import { callerCan, requirePermission } from "@/services/authz";
import { appError, notFound, permissionDenied, ServiceError } from "@/services/errors";
import { auditService } from "@/services/audit-service";
import { shouldFailSave } from "@/services/simulation";
import { getActiveTree } from "@/store/workspace-store";
import { isDocument } from "@/types";
import type {
  ConfigDocument,
  ConfigFormat,
  ConfigVersion,
  SecretAction,
  SecretAuditEntry,
  SecretDocument,
  SecretEntry,
  WorkspaceRole,
} from "@/types";

/**
 * Config and secret documents.
 *
 * The secret half is deliberately shaped like a service that holds encrypted
 * material: `getSecrets` can only ever return masks, and plaintext leaves the
 * module through one permission-checked call that also writes an audit entry.
 * Nothing here — and nothing that calls it — persists a revealed value.
 */

const MASK = "••••••••••••";

/** Where a newly added secret lands until someone says otherwise. */
const DEFAULT_ENVIRONMENT_OPTION_ID = ENVIRONMENT_OPTIONS[0]?.id ?? "env_0";

interface ConfigRecord {
  document: ConfigDocument;
  versions: ConfigVersion[];
}

interface SecretRecord {
  document: SecretDocument;
  /** Stands in for the encrypted column. Never leaves without a permission check. */
  plaintext: Map<string, string>;
  audit: SecretAuditEntry[];
}

const configs = new Map<string, ConfigRecord>();
const secrets = new Map<string, SecretRecord>();

function documentNode(nodeId: string) {
  const node = findNodeById(getActiveTree(), nodeId);
  if (!node || !isDocument(node)) throw notFound("That document");
  return node;
}

/* ------------------------------------------------------------------ config */

function configRecord(nodeId: string): ConfigRecord {
  const existing = configs.get(nodeId);
  if (existing) return existing;

  const node = documentNode(nodeId);
  const seed = CONFIG_SEEDS[node.slug] ?? CONFIG_SEEDS.default!;
  const format: ConfigFormat = seed.format ?? formatFromName(node.name);

  const document: ConfigDocument = {
    nodeId,
    name: node.name,
    format,
    environmentOptionId: seed.environmentOptionId,
    content: seed.content,
    version: 1,
    updatedAt: node.updatedAt,
    updatedBy: memberAt(1),
  };

  const record: ConfigRecord = {
    document,
    versions: [
      {
        id: nextId("cfgv"),
        version: 1,
        content: seed.content,
        createdAt: node.updatedAt,
        author: memberAt(1),
        summary: `${seed.content.split("\n").length} lines`,
      },
    ],
  };

  configs.set(nodeId, record);
  return record;
}

/**
 * The document, with its name taken from the node on every read.
 *
 * The name is the drive node's, not a second copy of it — the record seeded
 * one at creation and would otherwise keep showing it long after the node was
 * renamed, which is how a header and a breadcrumb end up disagreeing about
 * what you are looking at.
 */
async function getConfig(nodeId: string, signal?: AbortSignal): Promise<ConfigDocument> {
  await readDelay(signal);

  const record = configRecord(nodeId);
  const node = documentNode(nodeId);
  if (record.document.name !== node.name) {
    record.document = { ...record.document, name: node.name };
  }

  return record.document;
}

export interface SaveConfigInput {
  readonly nodeId: string;
  readonly content: string;
  readonly format?: ConfigFormat;
  readonly environmentOptionId?: string;
  /**
   * This save came from the debounce, not from a person.
   *
   * It is the difference between "I have finished this edit" and "you stopped
   * typing for a moment", and history should only record the first. Consecutive
   * autosaves by the same author fold into one version rather than cutting a
   * new one every second and a half — a history of four hundred entries, each a
   * keystroke apart, is not a history anybody can restore from.
   */
  readonly isAutosave?: boolean;
}

/**
 * Every deliberate save is a version. The PRD asks for no edit to go
 * unrecorded — which is about *edits*, not about the debounce timer that
 * carries them, so see `isAutosave` for where the line is drawn.
 */
async function saveConfig(
  { nodeId, content, format, environmentOptionId, isAutosave = false }: SaveConfigInput,
  signal?: AbortSignal,
): Promise<ConfigDocument> {
  await writeDelay(signal);
  const record = configRecord(nodeId);
  requirePermission(nodeId, "document.update", "edit this config document");

  if (shouldFailSave(record.document.name)) {
    throw new ServiceError(appError("unknown", `Could not save “${record.document.name}”`));
  }

  const previous = record.document;
  const head = record.versions[0];

  // Fold into the version already open only when this save and that one are
  // both the same author's autosaves — a manual save always starts a new one,
  // and so does anyone else's edit landing in between.
  const foldsIn =
    isAutosave && head !== undefined && head.isAutosave === true && head.author.id === CURRENT_USER.id;

  const version = foldsIn ? previous.version : previous.version + 1;

  record.document = {
    ...previous,
    content,
    format: format ?? previous.format,
    environmentOptionId: environmentOptionId ?? previous.environmentOptionId,
    version,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER,
  };

  const entry: ConfigVersion = {
    id: foldsIn && head ? head.id : nextId("cfgv"),
    version,
    content,
    createdAt: record.document.updatedAt,
    author: CURRENT_USER,
    summary: describeChange(foldsIn && head ? head.content : previous.content, content),
    ...(isAutosave ? { isAutosave: true } : {}),
  };

  if (foldsIn) record.versions[0] = entry;
  else record.versions.unshift(entry);

  return record.document;
}

export interface CreateConfigInput {
  readonly nodeId: string;
  readonly format: ConfigFormat;
}

/**
 * Seed a config document in a language the author chose.
 *
 * Without this the language would be guessed from the node's name, and a
 * document called "Payment Service Config" guesses ENV — so a JSON config
 * opened wrong, every time, until someone found the picker. Creating with the
 * language known is one fewer thing to correct.
 */
async function createConfig(
  { nodeId, format }: CreateConfigInput,
  signal?: AbortSignal,
): Promise<ConfigDocument> {
  await writeDelay(signal);

  const record = configRecord(nodeId);
  record.document = { ...record.document, format };
  return record.document;
}

function describeChange(before: string, after: string): string {
  const from = before.split("\n").length;
  const to = after.split("\n").length;
  const delta = to - from;

  if (delta === 0) return `${to} lines`;
  return delta > 0 ? `+${delta} lines` : `−${Math.abs(delta)} lines`;
}

/**
 * A copy, not the live array.
 *
 * Handing out the record's own list meant a caller holding yesterday's history
 * watched it grow as new versions landed — the "before" in a comparison
 * quietly became the "after". A snapshot is what a read of a history means.
 */
async function listConfigVersions(
  nodeId: string,
  signal?: AbortSignal,
): Promise<readonly ConfigVersion[]> {
  await readDelay(signal);
  return [...configRecord(nodeId).versions];
}

/** Restoring writes a new version rather than rewinding — history stays whole. */
async function restoreConfigVersion(
  nodeId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<ConfigDocument> {
  const record = configRecord(nodeId);
  const version = record.versions.find((candidate) => candidate.id === versionId);
  if (!version) throw notFound("That version");

  return saveConfig({ nodeId, content: version.content }, signal);
}

/* ------------------------------------------------------------------ secret */

function secretRecord(nodeId: string): SecretRecord {
  const existing = secrets.get(nodeId);
  if (existing) return existing;

  const node = documentNode(nodeId);
  const seeds = SECRET_SEEDS[node.slug] ?? SECRET_SEEDS.default!;

  const entries: SecretEntry[] = [];
  const plaintext = new Map<string, string>();

  seeds.forEach((seed, index) => {
    const id = `${nodeId}_secret_${index}`;
    entries.push({
      id,
      key: seed.key,
      maskedValue: MASK,
      environmentOptionId: seed.environmentOptionId,
      updatedAt: node.updatedAt,
      rotatedBy: memberAt(index + 1),
      ...(seed.note ? { note: seed.note } : {}),
    });
    plaintext.set(id, seed.value);
  });

  const record: SecretRecord = {
    document: { nodeId, name: node.name, entries },
    plaintext,
    audit: [],
  };

  secrets.set(nodeId, record);
  return record;
}

/** Masks only. There is no code path that returns a value from this call. */
async function getSecrets(nodeId: string, signal?: AbortSignal): Promise<SecretDocument> {
  await readDelay(signal);

  const record = secretRecord(nodeId);
  const node = documentNode(nodeId);
  if (record.document.name !== node.name) {
    record.document = { ...record.document, name: node.name };
  }

  return record.document;
}

/**
 * Whether plaintext may leave, for this caller, on this document.
 *
 * Two questions, and both have to say yes.
 *
 * `role` is the role the *client* is running as, which includes the role
 * preview — a workspace admin reading the app as a member has to be refused,
 * or the preview would be a demo rather than a check. It can only ever narrow.
 *
 * `callerCan` is the real one: the signed-in user's effective role on this
 * node, resolved from the store rather than taken from the request. A role
 * arriving in a call is a claim, and an endpoint that trusts one is asking the
 * caller how much access they would like.
 */
function mayUnlock(nodeId: string, role: WorkspaceRole, key: "secret.reveal" | "secret.rotate") {
  return roleHas(role, key) && callerCan(nodeId, key);
}

const mayReveal = (nodeId: string, role: WorkspaceRole): boolean =>
  mayUnlock(nodeId, role, "secret.reveal");

export interface RevealInput {
  readonly nodeId: string;
  readonly secretId: string;
  readonly role: WorkspaceRole;
  readonly action: SecretAction;
}

/**
 * The only door plaintext comes through. It checks the role, records an audit
 * entry with a timestamp and the caller's address, and returns the value once.
 */
async function revealSecret(
  { nodeId, secretId, role, action }: RevealInput,
  signal?: AbortSignal,
): Promise<string> {
  await readDelay(signal);
  const record = secretRecord(nodeId);
  const entry = record.document.entries.find((candidate) => candidate.id === secretId);
  if (!entry) throw notFound("That secret");

  if (!mayReveal(nodeId, role)) {
    // Recorded even when refused: a denied attempt is worth auditing.
    pushAudit(record, entry, action, false);
    throw permissionDenied(
      `Revealing ${entry.key} needs the Admin role`,
      "Ask a workspace admin to share it with you.",
    );
  }

  const value = record.plaintext.get(secretId);
  if (value === undefined) throw notFound("That secret");

  pushAudit(record, entry, action, true);
  return value;
}

/**
 * One write, two readers: the document's own trail and the workspace audit log
 * (SY-AUD-41). A denied attempt is recorded exactly as carefully as an allowed
 * one — a refusal nobody can see is not a control.
 */
function pushAudit(
  record: SecretRecord,
  entry: SecretEntry,
  action: SecretAction,
  allowed: boolean,
): void {
  // The server is the only honest source of an address; this stands in for it.
  const ip = "10.0.0.14";

  record.audit.unshift({
    id: nextId("aud"),
    action,
    secretId: entry.id,
    key: entry.key,
    actor: CURRENT_USER,
    at: nowIso(),
    ip: allowed ? ip : `${ip} (denied)`,
  });

  auditService.record({
    module: "secret",
    // Copying is a read of plaintext, so it files under reveal. Only an actual
    // write to the stored value is a rotation.
    action: action === "rotate" ? "secret.rotate" : "secret.reveal",
    actor: CURRENT_USER,
    ip,
    severity: allowed ? "warn" : "error",
    target: entry.key,
    outcome: allowed ? "allowed" : "denied",
    detail: allowed
      ? auditDetail(action)
      : "Refused: the role does not hold the permission for this action.",
  });
}

export interface CopySecretsInput {
  readonly nodeId: string;
  /** Empty means every secret in the document — "Copy all". */
  readonly secretIds: readonly string[];
  readonly role: WorkspaceRole;
}

export interface CopySecretsResult {
  /** `KEY=value` lines, ready for the clipboard. */
  readonly text: string;
  /** Keys included, so the caller can say how many without reading values. */
  readonly keys: readonly string[];
}

/**
 * Several secrets, as one `.env` block.
 *
 * The same door `revealSecret` uses, widened to a set: one permission check,
 * one audit entry per key, and the values assembled here rather than fetched
 * one at a time by the client — a loop of single reveals would write the same
 * audit trail but leave every value sitting in the page in between.
 *
 * There are no per-secret permissions in this model, so the check is
 * per-document and the answer is all or nothing. If per-secret scopes are ever
 * added, this is the one function that has to learn to return a subset.
 */
async function copySecrets(
  { nodeId, secretIds, role }: CopySecretsInput,
  signal?: AbortSignal,
): Promise<CopySecretsResult> {
  await readDelay(signal);
  const record = secretRecord(nodeId);

  const wanted = new Set(secretIds);
  const chosen = record.document.entries.filter(
    (entry) => wanted.size === 0 || wanted.has(entry.id),
  );

  if (chosen.length === 0) throw notFound("Those secrets");

  if (!mayReveal(nodeId, role)) {
    for (const entry of chosen) pushAudit(record, entry, "copy", false);
    throw permissionDenied(
      "Copying these values needs the Admin role",
      "Ask a workspace admin to share them with you.",
    );
  }

  const lines: EnvEntry[] = [];
  for (const entry of chosen) {
    const value = record.plaintext.get(entry.id);
    if (value === undefined) continue;

    lines.push({ key: entry.key, value });
    pushAudit(record, entry, "copy", true);
  }

  return { text: toEnvText(lines), keys: lines.map((line) => line.key) };
}

export interface SecretDraftEntry {
  /** The id of an existing secret, or null for one being added. */
  readonly id: string | null;
  readonly key: string;
  /**
   * Omitted where the value is untouched.
   *
   * That is what lets the editor rename a key, reorder the list or delete a
   * neighbour without ever holding the plaintext of the rows it is not
   * changing — the stored value stays where it is and is never round-tripped
   * through the client.
   */
  readonly value?: string;
}

export interface SaveSecretsInput {
  readonly nodeId: string;
  readonly entries: readonly SecretDraftEntry[];
  readonly role: WorkspaceRole;
}

/**
 * Write the document's secrets.
 *
 * Rotating a credential is the most consequential thing this service does, so
 * it takes the same shape as revealing one: an explicit permission check, an
 * audit entry per key touched, and no value in the log. The whole list is
 * replaced in the order given, which is what makes reordering, renaming and
 * deleting one operation rather than three endpoints.
 */
async function saveSecrets(
  { nodeId, entries, role }: SaveSecretsInput,
  signal?: AbortSignal,
): Promise<SecretDocument> {
  await writeDelay(signal);
  const record = secretRecord(nodeId);

  if (!mayUnlock(nodeId, role, "secret.rotate")) {
    throw permissionDenied(
      "Changing these secrets needs the Admin role",
      "Ask a workspace admin to rotate them for you.",
    );
  }

  const invalid = entries.find((entry) => !isValidSecretKey(entry.key));
  if (invalid) {
    throw new ServiceError(
      appError("validation", `“${invalid.key}” is not a usable name for a secret`, {
        detail: "A name cannot be empty or contain spaces, quotes or an equals sign.",
        isRetryable: false,
      }),
    );
  }

  const keys = entries.map((entry) => entry.key.trim());
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate) {
    throw new ServiceError(
      appError("validation", `“${duplicate}” appears twice`, {
        detail: "Every secret in a document needs its own name.",
        isRetryable: false,
      }),
    );
  }

  const previous = new Map(record.document.entries.map((entry) => [entry.id, entry]));
  const plaintext = new Map<string, string>();
  const next: SecretEntry[] = [];
  let seed = 0;

  for (const draft of entries) {
    const existing = draft.id ? previous.get(draft.id) : undefined;
    const id = existing?.id ?? `${nodeId}_secret_new_${(seed += 1).toString(36)}`;
    const key = draft.key.trim();

    // An untouched row keeps the stored value: the editor never had it, and it
    // must not be lost by being absent from the draft.
    const value = draft.value ?? (existing ? record.plaintext.get(existing.id) : undefined) ?? "";
    plaintext.set(id, value);

    const isChanged = !existing || existing.key !== key || draft.value !== undefined;

    const entry: SecretEntry = {
      id,
      key,
      maskedValue: MASK,
      environmentOptionId: existing?.environmentOptionId ?? DEFAULT_ENVIRONMENT_OPTION_ID,
      updatedAt: isChanged || !existing ? nowIso() : existing.updatedAt,
      rotatedBy: isChanged || !existing ? CURRENT_USER : existing.rotatedBy,
      ...(existing?.note ? { note: existing.note } : {}),
    };

    next.push(entry);
    if (isChanged) pushAudit(record, entry, "rotate", true);
  }

  // A removed secret is a rotation too — the trail has to show where it went.
  for (const gone of record.document.entries) {
    if (next.some((entry) => entry.id === gone.id)) continue;
    pushAudit(record, gone, "rotate", true);
  }

  record.document = { ...record.document, entries: next };
  record.plaintext = plaintext;

  return record.document;
}

/** What the trail says happened. Never the value — that is the whole point. */
function auditDetail(action: SecretAction): string {
  if (action === "rotate") return "Stored value replaced. The value itself is not recorded.";
  if (action === "copy") return "Value placed on the clipboard once. Not stored by the client.";
  return "Value returned once and cleared from the client on a timer.";
}

async function listSecretAudit(
  nodeId: string,
  signal?: AbortSignal,
): Promise<readonly SecretAuditEntry[]> {
  await readDelay(signal);
  return [...secretRecord(nodeId).audit];
}

/** Test seam. */
function reset(): void {
  configs.clear();
  secrets.clear();
}

export const devtoolsService = {
  getConfig,
  createConfig,
  saveConfig,
  listConfigVersions,
  restoreConfigVersion,
  getSecrets,
  revealSecret,
  copySecrets,
  saveSecrets,
  listSecretAudit,
  reset,
};

export { DIRECTORY };
