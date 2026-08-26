import type { ConfigFormat } from "@/types";

/**
 * A very small tokeniser for the three config dialects the workspace stores.
 *
 * It exists so config documents get real syntax colour without pulling in a
 * highlighting engine: the formats here are line-oriented and shallow, which is
 * exactly the case a hand-written lexer handles well.
 */

export type TokenKind =
  | "key"
  | "string"
  | "number"
  | "keyword"
  | "comment"
  | "punctuation"
  | "text";

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
}

const JSON_PATTERN =
  /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

function tokenizeJson(line: string): readonly Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of line.matchAll(JSON_PATTERN)) {
    const at = match.index ?? 0;
    if (at > cursor) tokens.push({ kind: "text", text: line.slice(cursor, at) });

    const [raw, key, string, keyword, number, punctuation] = match;
    if (key) tokens.push({ kind: "key", text: key });
    else if (string) tokens.push({ kind: "string", text: string });
    else if (keyword) tokens.push({ kind: "keyword", text: keyword });
    else if (number) tokens.push({ kind: "number", text: number });
    else if (punctuation) tokens.push({ kind: "punctuation", text: punctuation });

    cursor = at + raw.length;
  }

  if (cursor < line.length) tokens.push({ kind: "text", text: line.slice(cursor) });
  return tokens;
}

const ENV_PATTERN = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;

function tokenizeEnv(line: string): readonly Token[] {
  if (line.trimStart().startsWith("#")) return [{ kind: "comment", text: line }];

  const match = ENV_PATTERN.exec(line);
  if (!match) return [{ kind: "text", text: line }];

  const [, indent = "", key = "", separator = "", value = ""] = match;
  const tokens: Token[] = [
    { kind: "text", text: indent },
    { kind: "key", text: key },
    { kind: "punctuation", text: separator },
  ];

  if (value.length > 0) tokens.push({ kind: valueKind(value), text: value });
  return tokens;
}

const YAML_PATTERN = /^(\s*(?:-\s+)?)([A-Za-z0-9_.-]+)(\s*:\s*)(.*)$/;

function tokenizeYaml(line: string): readonly Token[] {
  if (line.trimStart().startsWith("#")) return [{ kind: "comment", text: line }];

  const match = YAML_PATTERN.exec(line);
  if (!match) return [{ kind: "text", text: line }];

  const [, indent = "", key = "", separator = "", value = ""] = match;
  const tokens: Token[] = [
    { kind: "text", text: indent },
    { kind: "key", text: key },
    { kind: "punctuation", text: separator },
  ];

  if (value.length > 0) tokens.push({ kind: valueKind(value), text: value });
  return tokens;
}

function valueKind(value: string): TokenKind {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return "number";
  if (/^(true|false|null|yes|no)$/i.test(trimmed)) return "keyword";
  return "string";
}

export function tokenizeLine(line: string, format: ConfigFormat): readonly Token[] {
  switch (format) {
    case "json":
      return tokenizeJson(line);
    case "env":
      return tokenizeEnv(line);
    case "yaml":
      return tokenizeYaml(line);
  }
}

export function tokenize(content: string, format: ConfigFormat): readonly (readonly Token[])[] {
  return content.split("\n").map((line) => tokenizeLine(line, format));
}

/** Colour per token kind, resolved from the workspace palette. */
export const TOKEN_CLASSES: Readonly<Record<TokenKind, string>> = {
  key: "text-kind-document",
  string: "text-kind-spreadsheet",
  number: "text-kind-video",
  keyword: "text-kind-board",
  comment: "text-faint-foreground italic",
  punctuation: "text-muted-foreground",
  text: "text-foreground",
};

/** Guess the dialect from a file or document name. */
export function formatFromName(name: string): ConfigFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  return "env";
}
