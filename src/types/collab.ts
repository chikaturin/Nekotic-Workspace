import type { SelectColor } from "./board";
import type { DirectoryUser, UserSummary } from "./user";

/* ------------------------------------------------------------- references */

/** Everything collaboration can point at. */
export type EntityKind = "project" | "folder" | "board" | "document" | "file" | "row";

/**
 * A pointer to one thing in the workspace.
 *
 * Comments, watches, notifications, search hits, My Work items and the recent
 * list all address their target through this one shape, so a single navigation
 * helper (`lib/entity-ref`) can route any of them.
 */
export interface EntityRef {
  readonly kind: EntityKind;
  /** Drive node that addresses the target — the routing anchor. */
  readonly nodeId: string;
  /** Board record, when `kind` is `"row"`. */
  readonly rowId?: string;
  /** Board the record belongs to, when `kind` is `"row"`. */
  readonly boardId?: string;
  /** Denormalised label so a notification renders without a second lookup. */
  readonly label: string;
}

/* --------------------------------------------------------------- comments */

export interface CommentAttachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Session object URL; null once the session that produced it ends. */
  readonly url: string | null;
}

export interface Comment {
  readonly id: string;
  /** `row:brd_x:row_y` or `document:nd_z` — always `refKey(target)`. */
  readonly targetKey: string;
  /** Denormalised target, so a comment can route without a second lookup. */
  readonly target: EntityRef;
  /** Root comment this replies to; null for a root comment. */
  readonly parentId: string | null;
  readonly author: DirectoryUser;
  /** Raw body, mentions encoded as `@[Name](usr_id)`. */
  readonly body: string;
  readonly mentionedUserIds: readonly string[];
  readonly attachments: readonly CommentAttachment[];
  readonly createdAt: string;
  readonly updatedAt: string;
  /** True once the body changed after posting — drives the "edited" label. */
  readonly isEdited: boolean;
  /** True while the comment exists only optimistically. */
  readonly isPending?: boolean;
}

/** A root comment with its replies. Replies never nest further than one level. */
export interface CommentThread {
  readonly root: Comment;
  readonly replies: readonly Comment[];
}

/* --------------------------------------------------------------- mentions */

/** One segment of a parsed comment body. */
export type BodySegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly userId: string; readonly label: string }
  | { readonly kind: "record"; readonly displayId: string };

/** An open `@` token in a composer: what was typed and where it sits. */
export interface MentionQuery {
  readonly query: string;
  /** Index of the `@`. */
  readonly start: number;
  /** Index just past the last character typed after the `@`. */
  readonly end: number;
}

/* ---------------------------------------------------------------- watches */

/** Only these three can be watched — a file or folder has no activity stream. */
export type WatchKind = "row" | "document" | "board";

export interface WatchEntry {
  readonly targetKey: string;
  readonly ref: EntityRef;
  readonly since: string;
}

/* ---------------------------------------------------------- notifications */

/** Why a notification exists. The inbox tabs are built from this. */
export type NotificationReason = "mention" | "assigned" | "comment" | "watch" | "system";

export type NotificationTab = "all" | "mentions" | "assigned" | "following";

export interface AppNotification {
  readonly id: string;
  readonly reason: NotificationReason;
  /** Inbox this belongs to. `list()` only ever returns the signed-in user's. */
  readonly recipientId: string;
  readonly actor: UserSummary;
  readonly title: string;
  readonly body: string;
  /** Null for workspace-level system notices that route nowhere. */
  readonly target: EntityRef | null;
  readonly createdAt: string;
  readonly isRead: boolean;
}

/* -------------------------------------------------------------- my work */

export type MyWorkWidgetId =
  | "assigned"
  | "mentioned"
  | "dueToday"
  | "overdue"
  | "recentlyUpdated";

export interface MyWorkItem {
  /** Stable per widget: the row id, prefixed by the widget it belongs to. */
  readonly id: string;
  readonly ref: EntityRef;
  readonly displayId: string;
  readonly title: string;
  readonly boardName: string;
  readonly statusLabel: string | null;
  readonly statusColor: SelectColor | null;
  readonly dueIso: string | null;
  readonly updatedAt: string;
  readonly assignees: readonly DirectoryUser[];
}

export interface MyWorkWidget {
  readonly id: MyWorkWidgetId;
  readonly label: string;
  readonly description: string;
  readonly items: readonly MyWorkItem[];
  /** Matches before the display cap, so "12 of 40" stays honest. */
  readonly total: number;
}

/* ----------------------------------------------------------------- search */

/**
 * Result buckets. `api`, `bug` and `qa` are records whose board was generated
 * from the matching template; `row` is every other record.
 */
export type SearchResultKind =
  | "document"
  | "api"
  | "bug"
  | "qa"
  | "row"
  | "file"
  | "comment"
  | "place";

export interface SearchResult {
  readonly id: string;
  readonly kind: SearchResultKind;
  readonly title: string;
  /** Where it lives — the board name or the folder path. */
  readonly subtitle: string;
  /** Matching excerpt, for comments and long text. */
  readonly snippet: string | null;
  readonly ref: EntityRef;
  /** Higher sorts first inside its group. */
  readonly score: number;
}

export interface SearchGroup {
  readonly kind: SearchResultKind;
  readonly label: string;
  readonly results: readonly SearchResult[];
}

/* ----------------------------------------------------------------- recent */

export interface RecentEntry {
  readonly ref: EntityRef;
  readonly visitedAt: string;
}
