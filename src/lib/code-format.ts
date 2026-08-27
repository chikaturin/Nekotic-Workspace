import { formatJson, lintJson } from "@/lib/json-lint";
import type { ConfigFormat } from "@/types";

/**
 * Reformatting a config document.
 *
 * Two languages have a formatter here, and the rest have none — stated, rather
 * than approximated. A formatter that re-indents code it cannot parse is worse
 * than no formatter at all: it is a button that silently damages a file, and
 * the damage is invisible until someone deploys it. Where there is no real
 * parser the control is disabled and says why, which is a smaller
 * disappointment than a mangled service config.
 *
 * That leaves the honest list short:
 *
 *   - **JSON** — `JSON.parse` and `JSON.stringify` are the parser and the
 *     printer. Nothing hand-rolled competes on correctness.
 *   - **ENV** — line-shaped, so "format" means whitespace around the first `=`
 *     and nothing else. Order is never touched: `.env` files are read top to
 *     bottom by tools that let a later line win, and sorting one alphabetically
 *     can change what a service boots with. Comments and blank lines survive
 *     verbatim for the same reason — the comment above a key belongs to it.
 *
 * TypeScript, JSX, YAML, SQL, CSS and the rest would each need a real parser.
 * Prettier is the obvious answer and is deliberately not installed: it is
 * several megabytes of parsers in a statically exported bundle, for a button.
 * See the report.
 */

export type FormatResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly message: string };

/** Shown on the disabled control, and the reason it is disabled. */
export const NO_FORMATTER_HINT = "Formatting is not available for this language.";

const FORMATTABLE: ReadonlySet<ConfigFormat> = new Set<ConfigFormat>(["json", "env"]);

export function canFormat(format: ConfigFormat): boolean {
  return FORMATTABLE.has(format);
}

/**
 * ENV, tidied.
 *
 * Only the spacing around the first `=` is normalised, plus trailing
 * whitespace. A line that is not a assignment — a comment, a blank, an
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
 * The formatted document, or the reason it could not be.
 *
 * A refusal returns the reason and *not* a replacement, so a caller cannot
 * accidentally write a half-formatted document back over a good one — the
 * source is only ever replaced on `ok`.
 */
export function formatSource(text: string, format: ConfigFormat): FormatResult {
  if (format === "json") {
    const problem = lintJson(text);
    if (problem) {
      return { ok: false, message: `Unable to format: ${problem.message.toLowerCase()}` };
    }
    return { ok: true, text: formatJson(text) };
  }

  if (format === "env") return { ok: true, text: formatEnv(text) };

  return { ok: false, message: NO_FORMATTER_HINT };
}
