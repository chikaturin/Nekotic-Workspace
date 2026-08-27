import type { ConfigFormat } from "@/types";

/**
 * Guess the language from a file or document name.
 *
 * A guess, and only ever a starting point — the language is stored on the
 * document and changeable from its header, so being wrong here costs one click
 * rather than making the document unreadable. Nothing infers a language from
 * the *content*: a JSON object and a JavaScript object literal are the same
 * bytes, and choosing between them by sniffing would silently switch a
 * document's language out from under whoever wrote it.
 */

const BY_EXTENSION: Readonly<Record<string, ConfigFormat>> = {
  json: "json",
  jsonc: "json",
  env: "env",
  yml: "yaml",
  yaml: "yaml",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  css: "css",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  conf: "nginx",
  txt: "text",
  md: "text",
};

/** Names that carry their language without an extension at all. */
const BY_NAME: Readonly<Record<string, ConfigFormat>> = {
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  ".env": "env",
  nginx: "nginx",
  makefile: "shell",
};

export function formatFromName(name: string): ConfigFormat {
  const lower = name.trim().toLowerCase();

  const named = BY_NAME[lower];
  if (named) return named;

  // ".env.production" is an ENV file; "app.config.json" is JSON. Reading the
  // last dotted part covers both without special-casing either.
  const parts = lower.split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const byExtension = extension ? BY_EXTENSION[extension] : undefined;
  if (byExtension) return byExtension;

  if (lower.startsWith(".env")) return "env";

  // Nothing recognisable. ENV is the format a config document has always
  // defaulted to, and it is the most forgiving of being wrong: every other
  // language's content still reads as plain text under it.
  return "env";
}
