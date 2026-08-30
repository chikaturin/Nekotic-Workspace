import type { Plugin } from "prettier";
import { formatJson, lintJson } from "@/lib/json-lint";
import type { ConfigFormat } from "@/types";

export type FormatResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly message: string };

export const NO_FORMATTER_HINT = "Formatting is not available for this language.";

type PrettierParser = "babel" | "typescript" | "css" | "html" | "yaml";

const PRETTIER_PARSERS: Partial<Readonly<Record<ConfigFormat, PrettierParser>>> = {
  javascript: "babel",
  jsx: "babel",
  typescript: "typescript",
  tsx: "typescript",
  css: "css",
  html: "html",
  yaml: "yaml",
};

export function canFormat(format: ConfigFormat): boolean {
  return format === "json" || format === "env" || format in PRETTIER_PARSERS;
}

const ASSIGNMENT = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function formatEnv(text: string): string {
  const lines = text.split("\n").map((line) => {
    const match = ASSIGNMENT.exec(line.trimEnd());
    if (!match) return line.trimEnd();

    const [, indent = "", key = "", value = ""] = match;
    return `${indent}${key}=${value}`;
  });

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

const pluginCache = new Map<PrettierParser, Promise<readonly Plugin[]>>();

async function pluginsFor(parser: PrettierParser): Promise<readonly Plugin[]> {
  const cached = pluginCache.get(parser);
  if (cached) return cached;

  const loading = (async (): Promise<readonly Plugin[]> => {
    switch (parser) {
      case "babel": {
        const [babel, estree] = await Promise.all([
          import("prettier/plugins/babel"),
          import("prettier/plugins/estree"),
        ]);
        return [babel.default ?? babel, estree.default ?? estree] as readonly Plugin[];
      }
      case "typescript": {
        const [typescript, estree] = await Promise.all([
          import("prettier/plugins/typescript"),
          import("prettier/plugins/estree"),
        ]);
        return [typescript.default ?? typescript, estree.default ?? estree] as readonly Plugin[];
      }
      case "css": {
        const postcss = await import("prettier/plugins/postcss");
        return [postcss.default ?? postcss] as readonly Plugin[];
      }
      case "html": {
        const html = await import("prettier/plugins/html");
        return [html.default ?? html] as readonly Plugin[];
      }
      case "yaml": {
        const yaml = await import("prettier/plugins/yaml");
        return [yaml.default ?? yaml] as readonly Plugin[];
      }
    }
  })();

  pluginCache.set(parser, loading);
  return loading;
}

function reasonFrom(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const [first = ""] = raw.split("\n");
  return first.trim() || "the document could not be parsed";
}

export async function formatSource(text: string, format: ConfigFormat): Promise<FormatResult> {
  if (format === "json") {
    const problem = lintJson(text);
    if (problem) {
      return { ok: false, message: `Unable to format: ${problem.message.toLowerCase()}` };
    }
    return { ok: true, text: formatJson(text) };
  }

  if (format === "env") return { ok: true, text: formatEnv(text) };

  const parser = PRETTIER_PARSERS[format];
  if (!parser) return { ok: false, message: NO_FORMATTER_HINT };

  try {
    const [{ format: run }, plugins] = await Promise.all([
      import("prettier/standalone"),
      pluginsFor(parser),
    ]);

    return { ok: true, text: await run(text, { parser, plugins: [...plugins] }) };
  } catch (error) {
    return { ok: false, message: `Unable to format: ${reasonFrom(error)}` };
  }
}
