import type { ConfigFormat } from "@/types";

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

  const parts = lower.split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const byExtension = extension ? BY_EXTENSION[extension] : undefined;
  if (byExtension) return byExtension;

  if (lower.startsWith(".env")) return "env";

  return "env";
}
