import type { StepNumbering } from "@/types";

/**
 * Numbered steps in a long-text cell.
 *
 * A QA case is written `B1: open the login page`, `B2: enter the username`; a
 * test plan uses `T1:`, `T2:`. The shape never varies — a prefix, a number, a
 * separator — so this is three fields of configuration and a parser, not a
 * templating engine.
 *
 * Two rules keep it honest:
 *
 *   - **The number is a number.** `B9` is followed by `B10`, never by `B:` or
 *     `B10` reached by incrementing a character. Everything here parses the
 *     digits and adds one.
 *   - **It never guesses.** Formatting a block that does not already read as a
 *     list of steps returns the text untouched. Renumbering somebody's prose
 *     because it happened to start with a letter and a digit is worse than
 *     doing nothing.
 */

/**
 * Plain numbers out of the box: `1:`, `2:`, `3:`.
 *
 * A prefix is a house convention — `B` for one team, `T` for another — and
 * guessing which one is worse than starting with none. Anybody who wants `B1:`
 * types a `B` into one field.
 */
export const DEFAULT_STEP_NUMBERING: StepNumbering = {
  enabled: false,
  prefix: "",
  start: 1,
  separator: ":",
};

export function stepNumberingOf(config: { readonly stepNumbering?: StepNumbering }): StepNumbering {
  return config.stepNumbering ?? DEFAULT_STEP_NUMBERING;
}

/**
 * `  B12:  open the page` → indent `  `, prefix `B`, number 12, separator `: `,
 * body `open the page`.
 *
 * The prefix is letters and spaces so `Step 1:` parses as readily as `B1:`; the
 * separator is whatever punctuation and space sit between the number and the
 * text. Both are captured rather than assumed, so reading a line never depends
 * on the column's current configuration — a cell written under one prefix stays
 * readable after somebody changes it.
 */
const STEP_LINE = /^([ \t]*)([A-Za-z][A-Za-z ]{0,7}?)?(\d+)([.):\-\]]?[ \t]*)(.*)$/;

export interface ParsedStep {
  readonly indent: string;
  readonly prefix: string;
  readonly number: number;
  readonly separator: string;
  readonly body: string;
}

export function parseStepLine(line: string): ParsedStep | null {
  const match = STEP_LINE.exec(line);
  if (!match) return null;

  const number = Number.parseInt(match[3] ?? "", 10);
  if (!Number.isFinite(number)) return null;

  return {
    indent: match[1] ?? "",
    prefix: match[2] ?? "",
    number,
    separator: match[4] ?? "",
    body: match[5] ?? "",
  };
}

/** `B` + `3` + `:` + one space — the token a new step line opens with. */
export function stepToken(config: StepNumbering, number: number): string {
  const separator = config.separator.trim();
  return `${config.prefix}${number}${separator}${separator ? " " : ""}`;
}

/**
 * What Enter inserts: a newline, then the next step's opening token.
 *
 * The number comes from the line the caret is on, parsed as an integer, so `B9`
 * is followed by `B10`. A line that is not a step at all starts the sequence at
 * the column's configured start — pressing Enter under a heading gives you step
 * one rather than nothing.
 */
export function nextStepInsertion(currentLine: string, config: StepNumbering): string {
  const parsed = parseStepLine(currentLine);
  const number = parsed ? parsed.number + 1 : config.start;

  // An existing line's own prefix and separator win, so a cell someone wrote
  // as `T1:` keeps going in `T`, whatever the column now says.
  const prefix = parsed && parsed.prefix ? parsed.prefix : config.prefix;
  const separator = parsed ? parsed.separator.trim() : config.separator.trim();

  return `\n${parsed?.indent ?? ""}${prefix}${number}${separator}${separator ? " " : ""}`;
}

/**
 * What a cell's editor opens with.
 *
 * A blank cell opens on its first step, already numbered. Without it the first
 * line is the one line with no number on it and the numbering only announces
 * itself on the second — you find out what the column does by pressing Enter,
 * which reads as the feature misfiring rather than starting.
 *
 * Only ever where there is nothing to disturb: a cell that is empty, or one a
 * keystroke is replacing. An existing value is never prefixed, and neither is
 * anything that already opens with a step.
 */
export function openingText(
  existing: string,
  typed: string | undefined,
  config: StepNumbering,
): string {
  const base = typed ?? existing;
  if (!config.enabled) return base;

  const isFresh = typed !== undefined || existing.trim().length === 0;
  if (!isFresh || parseStepLine(base) !== null) return base;

  return `${stepToken(config, config.start)}${base}`;
}

/**
 * Spaces immediately after the caret that opening a new step should absorb.
 *
 * Splitting `B1: open the page` at "open" would otherwise give `B2:  the page`
 * with two spaces — one from the step token, one that was separating the words.
 * Only ever horizontal whitespace, and only ever what the token has replaced.
 */
export function spacesAfter(text: string, caret: number): number {
  return /^[ \t]*/.exec(text.slice(caret))?.[0].length ?? 0;
}

/** The line the caret sits on, given the whole value and a caret offset. */
export function lineAt(text: string, caret: number): string {
  const upto = text.slice(0, Math.max(0, caret));
  const start = upto.lastIndexOf("\n") + 1;
  return upto.slice(start);
}

/* ------------------------------------------------------------------ paste */

/**
 * Number a block of pasted lines.
 *
 * Only for a paste that is plainly a list of unnumbered steps: if any line
 * already carries a number, the paste is left exactly as it arrived. Somebody
 * pasting `B1: … B2: …` has already numbered it, and a second pass would give
 * them `B1: B1: …`.
 */
export function numberPastedLines(text: string, config: StepNumbering): string | null {
  const lines = text.split(/\r?\n/);
  const filled = lines.filter((line) => line.trim().length > 0);
  if (filled.length < 2) return null;
  if (filled.some((line) => parseStepLine(line) !== null)) return null;

  let number = config.start;

  return lines
    .map((line) => {
      if (line.trim().length === 0) return line;
      const numbered = `${stepToken(config, number)}${line.trim()}`;
      number += 1;
      return numbered;
    })
    .join("\n");
}

/* ----------------------------------------------------------------- format */

/**
 * Whether a block reads as steps at all.
 *
 * Every non-empty line has to be one. A block where half the lines are numbered
 * and half are prose is ambiguous — it might be steps with notes between them —
 * and this refuses to decide.
 */
export function looksLikeSteps(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return false;

  return lines.every((line) => parseStepLine(line) !== null);
}

/**
 * Normalise an existing block: one prefix, one separator, numbered in sequence
 * from the configured start.
 *
 * `b1 open browser / b2 login` becomes `B1: Open browser / B2: Login`. The
 * bodies are never touched beyond trimming — the numbering is rewritten, the
 * user's words are not.
 *
 * Returns the text unchanged when the block does not read as steps, so the
 * action is safe to offer on anything.
 */
export function formatSteps(text: string, config: StepNumbering): string {
  if (!looksLikeSteps(text)) return text;

  let number = config.start;

  return text
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().length === 0) return "";

      const parsed = parseStepLine(line);
      if (!parsed) return line;

      const body = parsed.body.trim();
      const numbered = `${stepToken(config, number)}${body}`;
      number += 1;
      return numbered;
    })
    .join("\n");
}

/** Whether Format Steps would change anything — what disables the button. */
export function canFormatSteps(text: string, config: StepNumbering): boolean {
  return looksLikeSteps(text) && formatSteps(text, config) !== text;
}
