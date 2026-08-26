import { ROW_REFERENCE_SOURCE } from "@/lib/row-id";
import type { BodySegment, DirectoryUser, MentionQuery } from "@/types";

/**
 * Mentions inside a comment body.
 *
 * A mention is stored as `@[Mai Tran](usr_mai)`: the id is what the
 * notification fan-out reads, the label is what renders. Everything in this
 * module is pure, so the composer, the renderer and the service all agree on
 * one encoding.
 */

const MENTION_SOURCE = "@\\[([^\\]]{1,64})\\]\\(([A-Za-z0-9_-]{1,64})\\)";

/** Mention token, then record reference — matched in one pass, in order. */
const SEGMENT_PATTERN = new RegExp(`${MENTION_SOURCE}|${ROW_REFERENCE_SOURCE}`, "g");
const MENTION_PATTERN = new RegExp(MENTION_SOURCE, "g");

/** Longest run of characters after `@` still treated as an open mention. */
const MAX_QUERY_LENGTH = 40;
const MENTION_LIMIT = 6;

export function mentionToken(user: Pick<DirectoryUser, "id" | "name">): string {
  return `@[${user.name}](${user.id})`;
}

/**
 * The open `@` token at the caret, or null.
 *
 * A mention only starts at the beginning of the text or after whitespace, so
 * an email address never opens the picker, and a finished token is skipped
 * because its query would start with `[`.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const end = Math.max(0, Math.min(caret, text.length));

  let index = end - 1;
  while (index >= 0) {
    const character = text[index];
    if (character === undefined || /\s/.test(character)) return null;
    if (character === "@") break;
    if (end - index > MAX_QUERY_LENGTH) return null;
    index -= 1;
  }

  if (index < 0) return null;

  const preceding = index === 0 ? "" : text[index - 1] ?? "";
  if (preceding.length > 0 && !/[\s([]/.test(preceding)) return null;

  const query = text.slice(index + 1, end);
  if (query.startsWith("[") || query.includes("]") || query.includes(")")) return null;

  return { query, start: index, end };
}

/** Replace the open token with a finished mention and report the new caret. */
export function applyMention(
  text: string,
  range: MentionQuery,
  user: Pick<DirectoryUser, "id" | "name">,
): { readonly text: string; readonly caret: number } {
  const token = `${mentionToken(user)} `;
  return {
    text: `${text.slice(0, range.start)}${token}${text.slice(range.end)}`,
    caret: range.start + token.length,
  };
}

/**
 * People a query can mention. Members who left the workspace are resolvable
 * but not mentionable — notifying an inbox nobody reads is worse than nothing.
 */
export function mentionCandidates(
  people: readonly DirectoryUser[],
  query: string,
  limit = MENTION_LIMIT,
): readonly DirectoryUser[] {
  const needle = query.trim().toLowerCase();
  const active = people.filter((person) => person.isActive);

  if (needle.length === 0) return active.slice(0, limit);

  return active
    .filter(
      (person) =>
        person.name.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

/** Ids a body mentions, de-duplicated, in the order they appear. */
export function extractMentionIds(body: string): readonly string[] {
  const ids = new Set<string>();

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const id = match[2];
    if (id) ids.add(id);
  }

  return [...ids];
}

/**
 * Split a body into text, mention and record segments. The renderer maps this
 * straight onto elements — it never re-parses the raw string itself.
 */
export function parseBody(body: string): readonly BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;

  for (const match of body.matchAll(SEGMENT_PATTERN)) {
    const at = match.index ?? 0;
    if (at > cursor) segments.push({ kind: "text", text: body.slice(cursor, at) });

    const [raw, label, userId, prefix, sequence] = match;

    if (label && userId) {
      segments.push({ kind: "mention", userId, label });
    } else if (prefix && sequence) {
      segments.push({ kind: "record", displayId: `${prefix}-${sequence}` });
    }

    cursor = at + raw.length;
  }

  if (cursor < body.length) segments.push({ kind: "text", text: body.slice(cursor) });
  return segments;
}

/** Body with mention tokens flattened to `@Name` — for previews and search. */
export function plainBody(body: string): string {
  return body.replace(MENTION_PATTERN, (_match, label: string) => `@${label}`);
}
