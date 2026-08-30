import { ROW_REFERENCE_SOURCE } from "@/lib/row-id";
import type { BodySegment, DirectoryUser, MentionQuery } from "@/types";

const MENTION_SOURCE = "@\\[([^\\]]{1,64})\\]\\(([A-Za-z0-9_-]{1,64})\\)";

const SEGMENT_PATTERN = new RegExp(`${MENTION_SOURCE}|${ROW_REFERENCE_SOURCE}`, "g");
const MENTION_PATTERN = new RegExp(MENTION_SOURCE, "g");

const MAX_QUERY_LENGTH = 40;
const MENTION_LIMIT = 6;

export function mentionToken(user: Pick<DirectoryUser, "id" | "name">): string {
  return `@[${user.name}](${user.id})`;
}

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

/**
 * Chèn tên người được nhắc vào ô soạn thảo — dạng NGƯỜI ĐỌC ĐƯỢC.
 *
 * Trước đây chỗ này chèn thẳng `@[Tên](uuid)`. Đó là dạng lưu trữ, và nó đúng
 * cho server: id không đổi khi người ta đổi tên. Nhưng người đang gõ thì thấy
 * một chuỗi 45 ký tự đầy dấu ngoặc chen ngang câu của mình.
 *
 * Nên ô soạn thảo giữ `@Tên`, và `resolveMentions` dịch ngược lại thành dạng
 * lưu trữ ngay trước khi gửi.
 */
export function applyMention(
  text: string,
  range: MentionQuery,
  user: Pick<DirectoryUser, "id" | "name">,
): { readonly text: string; readonly caret: number } {
  const label = `@${user.name} `;
  return {
    text: `${text.slice(0, range.start)}${label}${text.slice(range.end)}`,
    caret: range.start + label.length,
  };
}

/** Ký tự đứng trước `@` thì mới tính là một lần nhắc tên. */
const MENTION_START = /[\s([]/;

function isMentionStart(text: string, at: number): boolean {
  if (at === 0) return true;

  const before = text[at - 1] ?? "";
  return MENTION_START.test(before);
}

/**
 * Đổi `@Tên` trong ô soạn thảo thành `@[Tên](id)` để gửi đi.
 *
 * Khớp theo tên DÀI NHẤT trước, vì tên có dấu cách ("Trần Văn A") sẽ bị tên
 * ngắn hơn ăn mất phần đầu nếu duyệt ngược lại.
 *
 * Hai người trùng tên thì KHÔNG đổi: gửi nhầm thông báo cho người lạ tệ hơn là
 * để nguyên chữ thường. Chuỗi đã ở dạng lưu trữ thì giữ nguyên, không đụng vào.
 */
export function resolveMentions(
  text: string,
  people: readonly DirectoryUser[],
): string {
  const active = people.filter((person) => person.isActive);
  const names = [...new Set(active.map((person) => person.name))].sort(
    (a, b) => b.length - a.length,
  );

  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    const at = text.indexOf("@", cursor);

    if (at === -1) break;

    // Đã là dạng lưu trữ rồi: nhảy qua trọn vẹn, đừng dịch hai lần.
    const token = new RegExp(`^${MENTION_SOURCE}`).exec(text.slice(at));

    if (token) {
      result += text.slice(cursor, at) + token[0];
      cursor = at + token[0].length;
      continue;
    }

    const name = isMentionStart(text, at)
      ? names.find(
          (candidate) =>
            text.slice(at + 1, at + 1 + candidate.length).toLowerCase() ===
            candidate.toLowerCase(),
        )
      : undefined;

    const matches =
      name === undefined
        ? []
        : active.filter((person) => person.name === name);

    if (matches.length !== 1 || name === undefined) {
      result += text.slice(cursor, at + 1);
      cursor = at + 1;
      continue;
    }

    result += text.slice(cursor, at) + mentionToken(matches[0]!);
    cursor = at + 1 + name.length;
  }

  return result + text.slice(cursor);
}

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

export function extractMentionIds(body: string): readonly string[] {
  const ids = new Set<string>();

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const id = match[2];
    if (id) ids.add(id);
  }

  return [...ids];
}

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

export function plainBody(body: string): string {
  return body.replace(MENTION_PATTERN, (_match, label: string) => `@${label}`);
}
