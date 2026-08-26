import { formatFromName } from "@/lib/syntax";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER, DIRECTORY, memberAt } from "@/mock/users";
import { CONFIG_SEEDS, SECRET_SEEDS } from "@/mock/devtools";
import { nextId, nowIso, readDelay, writeDelay } from "@/services/backend";
import { appError, notFound, permissionDenied, ServiceError } from "@/services/errors";
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

async function getConfig(nodeId: string, signal?: AbortSignal): Promise<ConfigDocument> {
  await readDelay(signal);
  return configRecord(nodeId).document;
}

export interface SaveConfigInput {
  readonly nodeId: string;
  readonly content: string;
  readonly format?: ConfigFormat;
  readonly environmentOptionId?: string;
}

/** Every save is a version. The PRD asks for no edit to go unrecorded. */
async function saveConfig(
  { nodeId, content, format, environmentOptionId }: SaveConfigInput,
  signal?: AbortSignal,
): Promise<ConfigDocument> {
  await writeDelay(signal);
  const record = configRecord(nodeId);

  if (shouldFailSave(record.document.name)) {
    throw new ServiceError(appError("unknown", `Could not save “${record.document.name}”`));
  }

  const previous = record.document;
  const version = previous.version + 1;

  record.document = {
    ...previous,
    content,
    format: format ?? previous.format,
    environmentOptionId: environmentOptionId ?? previous.environmentOptionId,
    version,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER,
  };

  record.versions.unshift({
    id: nextId("cfgv"),
    version,
    content,
    createdAt: record.document.updatedAt,
    author: CURRENT_USER,
    summary: describeChange(previous.content, content),
  });

  return record.document;
}

function describeChange(before: string, after: string): string {
  const from = before.split("\n").length;
  const to = after.split("\n").length;
  const delta = to - from;

  if (delta === 0) return `${to} lines`;
  return delta > 0 ? `+${delta} lines` : `−${Math.abs(delta)} lines`;
}

async function listConfigVersions(
  nodeId: string,
  signal?: AbortSignal,
): Promise<readonly ConfigVersion[]> {
  await readDelay(signal);
  return configRecord(nodeId).versions;
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
  return secretRecord(nodeId).document;
}

/** Roles allowed to see plaintext. Anything else is a 403, server-side. */
const PRIVILEGED_ROLES: ReadonlySet<WorkspaceRole> = new Set(["owner", "admin"]);

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

  if (!PRIVILEGED_ROLES.has(role)) {
    // Recorded even when refused: a denied attempt is worth auditing.
    pushAudit(record, entry, action, false);
    throw permissionDenied(
      `Revealing ${entry.key} needs an admin or owner role`,
      "Ask a workspace admin to share it with you.",
    );
  }

  const value = record.plaintext.get(secretId);
  if (value === undefined) throw notFound("That secret");

  pushAudit(record, entry, action, true);
  return value;
}

function pushAudit(
  record: SecretRecord,
  entry: SecretEntry,
  action: SecretAction,
  allowed: boolean,
): void {
  record.audit.unshift({
    id: nextId("aud"),
    action,
    secretId: entry.id,
    key: entry.key,
    actor: CURRENT_USER,
    at: nowIso(),
    // The server is the only honest source of an address; this stands in for it.
    ip: allowed ? "10.0.0.14" : "10.0.0.14 (denied)",
  });
}

async function listSecretAudit(
  nodeId: string,
  signal?: AbortSignal,
): Promise<readonly SecretAuditEntry[]> {
  await readDelay(signal);
  return secretRecord(nodeId).audit;
}

/** Test seam. */
function reset(): void {
  configs.clear();
  secrets.clear();
}

export const devtoolsService = {
  getConfig,
  saveConfig,
  listConfigVersions,
  restoreConfigVersion,
  getSecrets,
  revealSecret,
  listSecretAudit,
  reset,
};

export { DIRECTORY };
