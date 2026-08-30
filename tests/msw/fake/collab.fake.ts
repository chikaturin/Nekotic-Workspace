import { isWatchable, refKey } from "@/lib/entity-ref";
import { extractMentionIds, plainBody } from "@/lib/mentions";
import { upsertComment } from "@/lib/comments";
import { markRead as markSome } from "@/lib/notifications";
import { seedComments, seedNotifications, SEED_WATCHES } from "@/mock/collab";
import { boardFake } from "./board.fake";
import { realtime } from "@/lib/realtime/client";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import type {
  AppNotification,
  Comment,
  CommentAttachment,
  DirectoryUser,
  EntityRef,
  NotificationReason,
  UserSummary,
  WatchEntry,
} from "@/types";

/**
 * Backend giả cho comment, watch và notification — MỘT module cho cả ba.
 *
 * Ba service riêng ở FE trước đây phải gọi chéo nhau để làm việc này: đăng một
 * comment thì tự động theo dõi mục tiêu, bắn `mention` cho người được nhắc, và
 * bắn `comment` cho những người theo dõi còn lại. Đó là FAN-OUT, và nó là việc
 * của server — nó phải xảy ra trọn vẹn trong một lần ghi, không phải ba lần gọi
 * mà lần thứ hai có thể hỏng.
 *
 * Gộp chúng ở đây làm ranh giới đúng lại: FE gửi một comment, backend quyết
 * định ai nghe thấy.
 */

const PREVIEW_LENGTH = 140;

let comments: Map<string, Comment[]> | null = null;
let notifications: AppNotification[] | null = null;
const watchesByUser = new Map<string, Map<string, WatchEntry>>();
let isWatchSeeded = false;
let sequence = 0;

const nextId = (prefix: string): string =>
  `${prefix}_${(sequence += 1).toString(36)}`;
const nowIso = (): string => new Date().toISOString();

function commentCatalog(): Map<string, Comment[]> {
  comments ??= seedComments();

  return comments;
}

function bucket(targetKey: string): Comment[] {
  const existing = commentCatalog().get(targetKey);

  if (existing) return existing;

  const created: Comment[] = [];

  commentCatalog().set(targetKey, created);

  return created;
}

function notificationCatalog(): AppNotification[] {
  notifications ??= [...seedNotifications()];

  return notifications;
}

function inbox(userId: string): Map<string, WatchEntry> {
  const existing = watchesByUser.get(userId);

  if (existing) return existing;

  const created = new Map<string, WatchEntry>();

  watchesByUser.set(userId, created);

  return created;
}

function seedWatches(): void {
  if (isWatchSeeded) return;

  isWatchSeeded = true;

  const since = nowIso();

  for (const ref of SEED_WATCHES) {
    inbox(CURRENT_USER.id).set(refKey(ref), {
      targetKey: refKey(ref),
      ref,
      since,
    });
  }

  // Đồng đội cũng theo dõi bản ghi sprint, để fan-out có người nhận thật.
  const shared = SEED_WATCHES[0];

  if (shared) {
    for (const person of DIRECTORY.slice(1, 3)) {
      inbox(person.id).set(refKey(shared), {
        targetKey: refKey(shared),
        ref: shared,
        since,
      });
    }
  }
}

const currentAuthor = (): DirectoryUser =>
  DIRECTORY.find((person) => person.id === CURRENT_USER.id) ?? DIRECTORY[0]!;

function preview(body: string): string {
  const flat = plainBody(body).replace(/\s+/g, " ").trim();

  return flat.length > PREVIEW_LENGTH
    ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…`
    : flat;
}

const newestFirst = (a: AppNotification, b: AppNotification): number =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

function emit(input: {
  readonly reason: NotificationReason;
  readonly recipientId: string;
  readonly actor: UserSummary;
  readonly title: string;
  readonly body: string;
  readonly target: EntityRef | null;
}): AppNotification {
  const notification: AppNotification = {
    id: nextId("ntf"),
    ...input,
    createdAt: nowIso(),
    isRead: false,
  };

  notificationCatalog().unshift(notification);

  // Hộp thư nghe về nó qua ĐÚNG kênh mà một thay đổi từ máy khác đi qua: một
  // frame realtime. Backend thật phát frame này; fake phải phát nó, nếu không
  // test sẽ xanh trên một đường mà sản phẩm không có.
  if (notification.recipientId === CURRENT_USER.id) {
    realtime.emit({ type: "notification.created", notification });
  }

  return notification;
}

/** Người được NHẮC nghe một lần dưới dạng `mention`; người theo dõi còn lại nghe `comment`. */
function fanOut(comment: Comment, target: EntityRef): void {
  const mentioned = new Set(
    comment.mentionedUserIds.filter((id) => id !== comment.author.id),
  );

  for (const recipientId of mentioned) {
    emit({
      reason: "mention",
      recipientId,
      actor: comment.author,
      title: `${comment.author.name} mentioned you`,
      body: preview(comment.body),
      target,
    });
  }

  for (const [userId, entries] of watchesByUser) {
    if (userId === comment.author.id) continue;
    if (!entries.has(comment.targetKey)) continue;
    if (mentioned.has(userId)) continue;

    emit({
      reason: "comment",
      recipientId: userId,
      actor: comment.author,
      title: `${comment.author.name} commented on ${target.label}`,
      body: preview(comment.body),
      target,
    });
  }
}

/** Trả lời của một trả lời thuộc về cùng gốc — luồng chỉ sâu hai tầng. */
function rootIdFor(
  thread: readonly Comment[],
  parentId: string | null,
): { readonly rootId: string | null } | { readonly missing: true } {
  if (parentId === null) return { rootId: null };

  const parent = thread.find((comment) => comment.id === parentId);

  if (parent === undefined) return { missing: true };

  return { rootId: parent.parentId ?? parent.id };
}

export const collabFake = {
  comments: (targetKey: string): readonly Comment[] => [...bucket(targetKey)],

  replies: (commentId: string): readonly Comment[] =>
    [...commentCatalog().values()]
      .flat()
      .filter((comment) => comment.parentId === commentId),

  /** Mọi comment nhắc tới một người — nguồn của widget "Mentioned". */
  mentioning: (userId: string): readonly Comment[] =>
    [...commentCatalog().values()]
      .flat()
      .filter((comment) => comment.mentionedUserIds.includes(userId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),

  /** Quét phẳng cho tìm kiếm toàn workspace. */
  allComments: (): readonly Comment[] => [...commentCatalog().values()].flat(),

  addComment: (input: {
    readonly target: EntityRef;
    readonly body: string;
    readonly parentId?: string | null;
    readonly attachments?: readonly CommentAttachment[];
  }):
    | { readonly comment: Comment }
    | { readonly invalid: string }
    | { readonly missing: true } => {
    seedWatches();

    const trimmed = input.body.trim();
    const attachments = input.attachments ?? [];

    if (trimmed.length === 0 && attachments.length === 0) {
      return { invalid: "A comment needs a message or an attachment" };
    }

    const targetKey = refKey(input.target);
    const thread = bucket(targetKey);
    const root = rootIdFor(thread, input.parentId ?? null);

    if ("missing" in root) return { missing: true };

    const now = nowIso();
    const comment: Comment = {
      id: nextId("cmt"),
      targetKey,
      target: input.target,
      parentId: root.rootId,
      author: currentAuthor(),
      body: trimmed,
      mentionedUserIds: extractMentionIds(trimmed),
      attachments,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    };

    commentCatalog().set(targetKey, [...upsertComment(thread, comment)]);

    // Đăng comment đầu tiên là tự động theo dõi — thứ làm cho "Following" có
    // nghĩa mà không bắt ai phải bấm thêm một nút.
    if (isWatchable(input.target)) {
      const entries = inbox(comment.author.id);

      if (!entries.has(targetKey)) {
        entries.set(targetKey, { targetKey, ref: input.target, since: now });
      }
    }

    fanOut(comment, input.target);

    // Comment trên một HÀNG cũng là một mục hoạt động của hàng đó: hai panel
    // trong cùng một drawer không được phép kể hai câu chuyện khác nhau.
    boardFake.noteActivity(
      input.target,
      `commented on ${input.target.label}`,
      "commented",
    );

    return { comment };
  },

  editComment: (
    commentId: string,
    body: string,
  ):
    | { readonly comment: Comment }
    | { readonly forbidden: string }
    | { readonly invalid: string }
    | { readonly missing: true } => {
    for (const [targetKey, thread] of commentCatalog()) {
      const current = thread.find((comment) => comment.id === commentId);

      if (current === undefined) continue;

      if (current.author.id !== CURRENT_USER.id) {
        return { forbidden: "You can only edit your own comments" };
      }

      const trimmed = body.trim();

      if (trimmed.length === 0 && current.attachments.length === 0) {
        return { invalid: "A comment cannot be emptied" };
      }

      const updated: Comment = {
        ...current,
        body: trimmed,
        mentionedUserIds: extractMentionIds(trimmed),
        updatedAt: nowIso(),
        isEdited: true,
      };

      commentCatalog().set(targetKey, [...upsertComment(thread, updated)]);

      return { comment: updated };
    }

    return { missing: true };
  },

  watches: (userId: string): readonly WatchEntry[] => {
    seedWatches();

    return [...inbox(userId).values()];
  },

  setWatch: (
    ref: EntityRef,
    userId: string,
    isWatching: boolean,
  ): { readonly entries: readonly WatchEntry[] } | { readonly invalid: string } => {
    seedWatches();

    if (!isWatchable(ref)) {
      return { invalid: `A ${ref.kind} has no activity to follow` };
    }

    const key = refKey(ref);
    const entries = inbox(userId);

    if (isWatching) entries.set(key, { targetKey: key, ref, since: nowIso() });
    else entries.delete(key);

    return { entries: [...entries.values()] };
  },

  notifications: (userId: string): readonly AppNotification[] =>
    notificationCatalog()
      .filter((notification) => notification.recipientId === userId)
      .sort(newestFirst),

  unreadCount: (userId: string): number =>
    notificationCatalog().filter(
      (notification) =>
        notification.recipientId === userId && !notification.isRead,
    ).length,

  /** Id ngoài hộp thư của chính người gọi bị BỎ QUA, không phải áp dụng. */
  markRead: (ids: readonly string[], userId: string): void => {
    const owned = new Set(
      notificationCatalog()
        .filter((notification) => notification.recipientId === userId)
        .map((notification) => notification.id),
    );

    notifications = [...markSome(notificationCatalog(), ids.filter((id) => owned.has(id)))];
  },

  markAllRead: (userId: string): void => {
    const ids = notificationCatalog()
      .filter(
        (notification) =>
          notification.recipientId === userId && !notification.isRead,
      )
      .map((notification) => notification.id);

    notifications = [...markSome(notificationCatalog(), ids)];
  },

  /**
   * Đặt thẳng một thông báo vào hộp thư của bất kỳ ai — CHỈ dùng trong test.
   *
   * API không có endpoint nào làm việc này, và đó là điều đúng: thông báo sinh
   * ra từ một hành động thật (đăng comment, giao việc), không phải từ một lời
   * gọi của client. Test cần dựng sẵn trạng thái thì dựng ở phía server.
   */
  emitForTest: emit,

  reset: (): void => {
    comments = null;
    notifications = null;
    watchesByUser.clear();
    isWatchSeeded = false;
    sequence = 0;
  },
};
