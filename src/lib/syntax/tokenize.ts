import { GRAMMARS, type Grammar } from "@/lib/syntax/grammars";
import type { ConfigFormat } from "@/types";

/**
 * A small tokeniser for the config dialects the workspace stores.
 *
 * It exists so config documents get real syntax colour without pulling a
 * highlighting engine — and its own parsers — into a static bundle. What it
 * produces is *colour*, not a parse tree: nothing downstream asks it what the
 * code means, so a construct it renders as plain text is a missing highlight
 * and never a wrong answer. That is the trade being made, deliberately, and it
 * is why the formatter refuses to touch any language this file merely colours.
 *
 * Block comments are the one thing that cannot be decided a line at a time, so
 * the pass threads a small state through the document rather than restarting
 * at every newline.
 */

export type TokenKind =
  | "key"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "constant"
  | "comment"
  | "operator"
  | "punctuation"
  | "tag"
  | "attribute"
  | "text";

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
}

/** Colour per token kind, resolved from the workspace's syntax palette. */
export const TOKEN_CLASSES: Readonly<Record<TokenKind, string>> = {
  key: "text-syntax-key",
  string: "text-syntax-string",
  number: "text-syntax-number",
  keyword: "text-syntax-keyword",
  type: "text-syntax-type",
  function: "text-syntax-function",
  constant: "text-syntax-number",
  comment: "text-syntax-comment italic",
  operator: "text-syntax-operator",
  punctuation: "text-syntax-punctuation",
  tag: "text-syntax-tag",
  attribute: "text-syntax-attribute",
  text: "text-syntax-foreground",
};

/* ------------------------------------------------------- line-shaped ones */

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
    else if (keyword) tokens.push({ kind: "constant", text: keyword });
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
    { kind: "operator", text: separator },
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
  if (/^(true|false|null|yes|no)$/i.test(trimmed)) return "constant";
  return "string";
}

/* ------------------------------------------------------------ markup */

const MARKUP_PATTERN =
  /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w:.-]*)|(\/?>)|([A-Za-z_:][\w:.-]*)(?==)|("[^"]*"|'[^']*')/g;

/**
 * HTML and XML.
 *
 * The same shape either way: a tag name, attributes, quoted values. Nothing
 * here parses nesting, and it does not need to — an unclosed tag is the
 * author's problem to see, which is easier when the tag is coloured.
 */
function tokenizeMarkup(line: string): readonly Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of line.matchAll(MARKUP_PATTERN)) {
    const at = match.index ?? 0;
    if (at > cursor) tokens.push({ kind: "text", text: line.slice(cursor, at) });

    const [raw, comment, open, close, attribute, value] = match;
    if (comment) tokens.push({ kind: "comment", text: comment });
    else if (open) tokens.push({ kind: "tag", text: open });
    else if (close) tokens.push({ kind: "tag", text: close });
    else if (attribute) tokens.push({ kind: "attribute", text: attribute });
    else if (value) tokens.push({ kind: "string", text: value });

    cursor = at + raw.length;
  }

  if (cursor < line.length) tokens.push({ kind: "text", text: line.slice(cursor) });
  return tokens;
}

/* ------------------------------------------------------------ the lexer */

const IDENT_START = /[A-Za-z_$@]/;
const IDENT_BODY = /[\w$-]/;
const OPERATORS = new Set("+-*/%=<>!&|^~?:".split(""));
const PUNCTUATION = new Set("{}[]().,;#".split(""));

/** Whether the tokeniser is currently inside a comment that spans lines. */
export interface TokenizeState {
  readonly inBlockComment: boolean;
}

export const INITIAL_STATE: TokenizeState = { inBlockComment: false };

interface LineResult {
  readonly tokens: readonly Token[];
  readonly state: TokenizeState;
}

function startsWithAt(line: string, at: number, prefixes: readonly string[]): string | null {
  for (const prefix of prefixes) {
    if (line.startsWith(prefix, at)) return prefix;
  }
  return null;
}

/** Reads a quoted run, tolerating a string the author has not closed yet. */
function readString(line: string, at: number, quote: string): number {
  let cursor = at + 1;

  while (cursor < line.length) {
    const char = line[cursor];
    if (char === "\\") {
      cursor += 2;
      continue;
    }
    cursor += 1;
    if (char === quote) return cursor;
  }

  return line.length;
}

function identifierKind(word: string, grammar: Grammar, next: string): TokenKind {
  const needle = grammar.ignoreCase ? word.toUpperCase() : word;
  const has = (set: ReadonlySet<string>): boolean =>
    grammar.ignoreCase
      ? [...set].some((entry) => entry.toUpperCase() === needle)
      : set.has(needle);

  if (has(grammar.constants)) return "constant";
  if (has(grammar.keywords)) return "keyword";
  if (has(grammar.types)) return "type";

  // A word immediately followed by "(" is being called, and one followed by
  // ":" is naming something — the two cases worth colouring without a parser.
  if (next === "(") return "function";
  if (next === ":") return "key";
  return "text";
}

function tokenizeWith(line: string, grammar: Grammar, state: TokenizeState): LineResult {
  const tokens: Token[] = [];
  const block = grammar.blockComment;
  let cursor = 0;
  let inBlockComment = state.inBlockComment;

  if (inBlockComment && block) {
    const close = line.indexOf(block[1]);
    if (close === -1) return { tokens: [{ kind: "comment", text: line }], state };

    tokens.push({ kind: "comment", text: line.slice(0, close + block[1].length) });
    cursor = close + block[1].length;
    inBlockComment = false;
  }

  let plain = "";
  const flush = () => {
    if (plain.length > 0) tokens.push({ kind: "text", text: plain });
    plain = "";
  };

  while (cursor < line.length) {
    const char = line[cursor] ?? "";

    const lineComment = startsWithAt(line, cursor, grammar.lineComment);
    if (lineComment) {
      flush();
      tokens.push({ kind: "comment", text: line.slice(cursor) });
      cursor = line.length;
      break;
    }

    if (block && line.startsWith(block[0], cursor)) {
      flush();
      const close = line.indexOf(block[1], cursor + block[0].length);
      if (close === -1) {
        tokens.push({ kind: "comment", text: line.slice(cursor) });
        return { tokens, state: { inBlockComment: true } };
      }
      tokens.push({ kind: "comment", text: line.slice(cursor, close + block[1].length) });
      cursor = close + block[1].length;
      continue;
    }

    if (grammar.quotes.includes(char)) {
      flush();
      const end = readString(line, cursor, char);
      tokens.push({ kind: "string", text: line.slice(cursor, end) });
      cursor = end;
      continue;
    }

    if (/\d/.test(char) && !IDENT_BODY.test(line[cursor - 1] ?? " ")) {
      flush();
      let end = cursor;
      while (end < line.length && /[\w.]/.test(line[end] ?? "")) end += 1;
      tokens.push({ kind: "number", text: line.slice(cursor, end) });
      cursor = end;
      continue;
    }

    if (IDENT_START.test(char)) {
      flush();
      let end = cursor + 1;
      while (end < line.length && IDENT_BODY.test(line[end] ?? "")) end += 1;

      const word = line.slice(cursor, end);
      let after = end;
      while (after < line.length && (line[after] ?? "") === " ") after += 1;

      tokens.push({ kind: identifierKind(word, grammar, line[after] ?? ""), text: word });
      cursor = end;
      continue;
    }

    if (OPERATORS.has(char)) {
      flush();
      tokens.push({ kind: "operator", text: char });
      cursor += 1;
      continue;
    }

    if (PUNCTUATION.has(char)) {
      flush();
      tokens.push({ kind: "punctuation", text: char });
      cursor += 1;
      continue;
    }

    plain += char;
    cursor += 1;
  }

  flush();
  return { tokens, state: { inBlockComment } };
}

/* --------------------------------------------------------------- surface */

export function tokenizeLine(line: string, format: ConfigFormat): readonly Token[] {
  return tokenizeLineWithState(line, format, INITIAL_STATE).tokens;
}

function tokenizeLineWithState(
  line: string,
  format: ConfigFormat,
  state: TokenizeState,
): LineResult {
  switch (format) {
    case "json":
      return { tokens: tokenizeJson(line), state };
    case "env":
      return { tokens: tokenizeEnv(line), state };
    case "yaml":
      return { tokens: tokenizeYaml(line), state };
    case "html":
    case "xml":
      return { tokens: tokenizeMarkup(line), state };
    case "text":
      return { tokens: [{ kind: "text", text: line }], state };
    default: {
      const grammar = GRAMMARS[format];
      if (!grammar) return { tokens: [{ kind: "text", text: line }], state };
      return tokenizeWith(line, grammar, state);
    }
  }
}

/** The whole document, with block-comment state carried between lines. */
export function tokenize(content: string, format: ConfigFormat): readonly (readonly Token[])[] {
  let state = INITIAL_STATE;

  return content.split("\n").map((line) => {
    const result = tokenizeLineWithState(line, format, state);
    state = result.state;
    return result.tokens;
  });
}
