/**
 * JSON validation with a caret position.
 *
 * `JSON.parse` is the parser — nothing hand-rolled can match it for accuracy.
 * What is added here is turning the engine's message into a line and column
 * the editor can underline.
 */

export interface JsonProblem {
  readonly message: string;
  /** 1-based. */
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

const POSITION_PATTERN = /position (\d+)/i;
const LINE_COLUMN_PATTERN = /line (\d+) column (\d+)/i;

export function lintJson(text: string): JsonProblem | null {
  if (text.trim().length === 0) return null;

  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return locate(text, message);
  }
}

function locate(text: string, message: string): JsonProblem {
  const explicit = LINE_COLUMN_PATTERN.exec(message);
  if (explicit) {
    const line = Number.parseInt(explicit[1] ?? "1", 10);
    const column = Number.parseInt(explicit[2] ?? "1", 10);
    return { message: clean(message), line, column, offset: offsetOf(text, line, column) };
  }

  const positional = POSITION_PATTERN.exec(message);
  const offset = positional ? Number.parseInt(positional[1] ?? "0", 10) : 0;
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n");

  return { message: clean(message), line, column, offset };
}

/** Engines append their own position text; the editor shows it separately. */
function clean(message: string): string {
  return message
    .replace(/\s*in JSON at position \d+.*$/i, "")
    .replace(/^JSON\.parse:\s*/i, "")
    .trim();
}

function offsetOf(text: string, line: number, column: number): number {
  const lines = text.split("\n");
  let offset = 0;

  for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }

  return offset + column - 1;
}

/** Pretty-print, leaving the text untouched when it does not parse. */
export function formatJson(text: string): string {
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return text;
  }
}
