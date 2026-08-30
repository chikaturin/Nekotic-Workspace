
export interface EnvEntry {
  readonly key: string;
  readonly value: string;
}

export interface EnvProblem {
  readonly line: number;
  readonly text: string;
}

export interface EnvParseResult {
  readonly entries: readonly EnvEntry[];
  readonly duplicates: readonly string[];
  readonly invalid: readonly EnvProblem[];
  readonly droppedComments: number;
}

const ASSIGNMENT = /^\s*(?:export\s+)?([^=\s][^=]*?)\s*=(.*)$/s;

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

    if (seen.has(key)) {
      if (!duplicates.includes(key)) duplicates.push(key);
    } else {
      seen.add(key);
    }

    entries.push({ key, value });
  });

  return { entries, duplicates, invalid, droppedComments };
}

export function isValidSecretKey(key: string): boolean {
  return key.trim().length > 0 && !/[\s="']/.test(key);
}

export function isConventionalSecretKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

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

export function toEnvText(entries: readonly EnvEntry[]): string {
  if (entries.length === 0) return "";
  return `${entries.map((entry) => `${entry.key}=${quote(entry.value)}`).join("\n")}\n`;
}
