/**
 * Reading and writing `KEY=value` files.
 *
 * A secret document is a list of named values, and the way everybody already
 * has those written down is a `.env` file — so pasting one in is the fastest
 * path from "I have the credentials" to "the workspace has the credentials".
 * This is the parser for that paste, and the printer for the copy that goes the
 * other way.
 *
 * The whole file is pure and holds no secret of its own: it takes a string and
 * returns a structure. Nothing here logs, caches, or persists — see
 * `use-secret-editor` for where the parsed values live and how long for.
 *
 * The one rule worth stating: a value is everything after the **first** `=`.
 * `line.split("=")` is the bug this file exists to not have — connection
 * strings, base64 and JWTs all contain `=`, and splitting on every one of them
 * silently truncates exactly the credentials that matter most.
 */

export interface EnvEntry {
  readonly key: string;
  readonly value: string;
}

export interface EnvProblem {
  /** 1-based, so it can be pointed at in the text the user pasted. */
  readonly line: number;
  readonly text: string;
}

export interface EnvParseResult {
  /** In the order they appeared. A later duplicate does not overwrite. */
  readonly entries: readonly EnvEntry[];
  /** Keys that appeared more than once, once each, in order of first sight. */
  readonly duplicates: readonly string[];
  /** Lines that are neither blank, a comment, nor an assignment. */
  readonly invalid: readonly EnvProblem[];
  /** How many comment lines were dropped — the editor says so out loud. */
  readonly droppedComments: number;
}

const ASSIGNMENT = /^\s*(?:export\s+)?([^=\s][^=]*?)\s*=(.*)$/s;

/**
 * Strip one layer of matching quotes, and honour the escapes that layer
 * implies.
 *
 * Single quotes are literal in every `.env` dialect worth matching, so nothing
 * inside them is unescaped. Double quotes take the usual `\n`, `\t`, `\"` and
 * `\\` — a private key pasted as a one-line `"-----BEGIN...\n..."` is the
 * common case, and reading it literally would store the backslashes.
 */
function unquote(raw: string): string {
  const value = raw.trim();
  const first = value[0];
  const last = value[value.length - 1];

  if (value.length >= 2 && (first === '"' || first === "'") && last === first) {
    const inner = value.slice(1, -1);
    if (first === "'") return inner;

    return inner.replace(/\\(n|r|t|"|\\)/g, (_, code: string) => {
      if (code === "n") return "\n";
      if (code === "r") return "\r";
      if (code === "t") return "\t";
      return code;
    });
  }

  return value;
}

export function parseEnv(text: string): EnvParseResult {
  const entries: EnvEntry[] = [];
  const invalid: EnvProblem[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  let droppedComments = 0;

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    if (trimmed.startsWith("#")) {
      droppedComments += 1;
      return;
    }

    const match = ASSIGNMENT.exec(line);
    if (!match) {
      invalid.push({ line: index + 1, text: trimmed });
      return;
    }

    const key = (match[1] ?? "").trim();
    const value = unquote(match[2] ?? "");

    // A repeat is reported and kept, never silently collapsed: which of the two
    // the author meant is not something a parser can know, and picking one is
    // how a credential file quietly boots with the wrong password.
    if (seen.has(key)) {
      if (!duplicates.includes(key)) duplicates.push(key);
    } else {
      seen.add(key);
    }

    entries.push({ key, value });
  });

  return { entries, duplicates, invalid, droppedComments };
}

/**
 * A key the store can hold at all: something, on one line, that is not itself
 * an assignment.
 *
 * Deliberately permissive. Plenty of real deployments use keys this side of
 * the `UPPER_SNAKE` convention — dotted namespaces, hyphens, lowercase — and
 * refusing to store one because it is unfashionable would make the editor
 * useless for the config it was needed for.
 */
export function isValidSecretKey(key: string): boolean {
  return key.trim().length > 0 && !/[\s="']/.test(key);
}

/** The `UPPER_SNAKE` shape that reads as an environment variable. */
export function isConventionalSecretKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

/**
 * Quote a value only where leaving it bare would change it — whitespace at
 * either end, a line break, or a `#` that would otherwise read as a comment.
 * Quoting everything makes a copied file noisier to read for no gain.
 */
function quote(value: string): string {
  const needsQuotes = /[\n\r"#]/.test(value) || value !== value.trim() || value.length === 0;
  if (!needsQuotes) return value;

  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");

  return `"${escaped}"`;
}

/** Entries back out as an `.env` file, in the order given. */
export function toEnvText(entries: readonly EnvEntry[]): string {
  if (entries.length === 0) return "";
  return `${entries.map((entry) => `${entry.key}=${quote(entry.value)}`).join("\n")}\n`;
}
