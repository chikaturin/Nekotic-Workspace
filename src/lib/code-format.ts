import type { Plugin } from "prettier";
import { formatJson, lintJson } from "@/lib/json-lint";
import type { ConfigFormat } from "@/types";

/**
 * Reformatting a config document.
 *
 * Prettier does the work for every language that has a real parser, and it is
 * loaded **on demand**: nothing here is in the page's bundle until somebody
 * presses Format, and only the one parser that language needs is fetched. That
 * is what makes shipping a formatter to a statically exported app reasonable —
 * the alternative that was tried first, refusing to format anything but JSON,
 * was cheap for the bundle and useless for the person looking at a badly
 * indented TSX file.
 *
 * Two languages deliberately do *not* go through Prettier:
 *
 *   - **JSON** — `JSON.parse` and `JSON.stringify` are already exact, already
 *     loaded, and already what the linter in the header uses. Pulling a parser
 *     over the network to do the same job would be slower and no more correct.
 *   - **ENV** — Prettier has no parser for it, and "format" here means only
 *     the whitespace around the first `=`. Order is never touched: `.env` files
 *     are read top to bottom by tools that let a later line win, so sorting one
 *     alphabetically can change what a service boots with. Comments and blank
 *     lines survive verbatim for the same reason — the comment above a key
 *     belongs to it.
 *
 * The rest — SQL, Shell, Dockerfile, Nginx, XML, plain text — have no parser in
 * Prettier's core and are honestly reported as unsupported rather than being
 * run through a formatter for a language they are not. A formatter that
 * re-indents code it cannot parse is a button that silently damages a file.
 */

export type FormatResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly message: string };

/** Shown on the disabled control, and the reason it is disabled. */
export const NO_FORMATTER_HINT = "Formatting is not available for this language.";

/**
 * Which Prettier parser each language needs, and which plugins carry it.
 *
 * The plugin list is the reason this is a table rather than a switch: every
 * estree-based parser needs the estree printer alongside it, and forgetting it
 * fails at runtime with a message about a missing printer rather than at build
 * time.
 */
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

/** Languages this module can reformat at all — Prettier's, plus our own two. */
export function canFormat(format: ConfigFormat): boolean {
  return format === "json" || format === "env" || format in PRETTIER_PARSERS;
}

/**
 * ENV, tidied.
 *
 * Only the spacing around the first `=` is normalised, plus trailing
 * whitespace. A line that is not an assignment — a comment, a blank, an
 * `export`, something half-typed — is passed through as it was found. There is
 * no line this can turn into a different line's meaning, which is the property
 * that makes it safe to run on a production credential file.
 */
const ASSIGNMENT = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function formatEnv(text: string): string {
  const lines = text.split("\n").map((line) => {
    const match = ASSIGNMENT.exec(line.trimEnd());
    if (!match) return line.trimEnd();

    const [, indent = "", key = "", value = ""] = match;
    return `${indent}${key}=${value}`;
  });

  // One trailing newline, whatever the file arrived with.
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

/**
 * Prettier's own plugins, fetched the first time a language needs one.
 *
 * Cached by parser, so formatting twice costs one network round trip. Every
 * import is a separate chunk — a TypeScript document never downloads the CSS
 * printer.
 */
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

/**
 * What Prettier said went wrong, as one line.
 *
 * Its messages carry a code frame — several lines of source with a caret under
 * the offending column — which is genuinely useful in a terminal and is noise
 * in a toast. The first line is the sentence; the frame is dropped.
 */
function reasonFrom(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const [first = ""] = raw.split("\n");
  return first.trim() || "the document could not be parsed";
}

/**
 * The formatted document, or the reason it could not be.
 *
 * A refusal returns the reason and *not* a replacement, so a caller cannot
 * accidentally write a half-formatted document back over a good one — the
 * source is only ever replaced on `ok`.
 */
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

    // Prettier's defaults, deliberately: this is a config document, not a
    // repository with a house style, and inventing one here would mean every
    // document reformatted to something nobody chose.
    return { ok: true, text: await run(text, { parser, plugins: [...plugins] }) };
  } catch (error) {
    return { ok: false, message: `Unable to format: ${reasonFrom(error)}` };
  }
}
