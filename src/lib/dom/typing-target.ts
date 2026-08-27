/**
 * Telling "the user is typing into a field" from "the user is driving the grid".
 *
 * The table's spreadsheet keyboard model lives on one handler bound to the grid
 * container, and that container holds more than records: the column headers sit
 * inside it, and a header being renamed puts a text field under the same
 * handler. Every keystroke into that field bubbled straight into the grid —
 * a letter opened a cell editor somewhere else and stole the focus, Enter began
 * editing a record, the arrow keys had their default prevented so the caret
 * could not move, and Escape cleared the selection. Renaming a column looked
 * broken because it *was*: the field never kept a keystroke long enough to be
 * committed.
 *
 * The predicates are structural rather than `instanceof` checks so they can be
 * unit-tested without a DOM, and so a target from another document or a
 * synthetic event cannot slip past them.
 */

interface TargetLike {
  readonly tagName?: unknown;
  readonly isContentEditable?: unknown;
  readonly closest?: (selector: string) => unknown;
}

const TYPING_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function asElement(target: unknown): TargetLike | null {
  return target !== null && typeof target === "object" ? (target as TargetLike) : null;
}

/** A field the keystroke belongs to — anything the grid must not act on. */
export function isTypingTarget(target: unknown): boolean {
  const element = asElement(target);
  if (!element) return false;

  if (typeof element.tagName === "string" && TYPING_TAGS.has(element.tagName)) return true;
  return element.isContentEditable === true;
}

/**
 * Whether the keystroke came from the header rather than from a record.
 *
 * The header's own controls — the menu button, the resize grip, the rename
 * field — answer their own keys. None of them is a cell, and the grid's cursor
 * model has nothing to say about any of them.
 */
export function isHeaderTarget(target: unknown): boolean {
  const element = asElement(target);
  if (!element || typeof element.closest !== "function") return false;

  return element.closest('[role="columnheader"]') != null;
}

/** The one question the grid's key handler asks before doing anything. */
export function isGridKeyTarget(target: unknown): boolean {
  return !isTypingTarget(target) && !isHeaderTarget(target);
}
