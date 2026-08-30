import type { SelectColor } from "./board";
import type { DirectoryUser, UserSummary } from "./user";

export type EntityKind = "project" | "folder" | "board" | "document" | "file" | "row";

export interface EntityRef {
  readonly kind: EntityKind;
  readonly nodeId: string;
  readonly rowId?: string;
  readonly boardId?: string;
  readonly label: string;
}

export interface CommentAttachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly url: string | null;
}

export interface Comment {
  readonly id: string;
  readonly targetKey: string;
  readonly target: EntityRef;
  readonly parentId: string | null;
  readonly author: DirectoryUser;
  readonly body: string;
  readonly mentionedUserIds: readonly string[];
  readonly attachments: readonly CommentAttachment[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isEdited: boolean;
  readonly isPending?: boolean;
}

export interface CommentThread {
  readonly root: Comment;
  readonly replies: readonly Comment[];
}

export type BodySegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly userId: string; readonly label: string }
  | { readonly kind: "record"; readonly displayId: string };

export interface MentionQuery {
  readonly query: string;
  readonly start: number;
  readonly end: number;
}

export type WatchKind = "row" | "document" | "board";

export interface WatchEntry {
  readonly targetKey: string;
  readonly ref: EntityRef;
  readonly since: string;
}

export type NotificationReason = "mention" | "assigned" | "comment" | "watch" | "system";

export type NotificationTab = "all" | "mentions" | "assigned" | "following";

export interface AppNotification {
  readonly id: string;
  readonly reason: NotificationReason;
  readonly recipientId: string;
  readonly actor: UserSummary;
  readonly title: string;
  readonly body: string;
  readonly target: EntityRef | null;
  readonly createdAt: string;
  readonly isRead: boolean;
}

export type MyWorkWidgetId =
  | "overdue"
  | "dueToday"
  | "dueThisWeek"
  | "unscheduled";

export interface MyWorkItem {
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
  readonly total: number;
}

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
  readonly subtitle: string;
  readonly snippet: string | null;
  readonly ref: EntityRef;
  readonly score: number;
}

export interface SearchGroup {
  readonly kind: SearchResultKind;
  readonly label: string;
  readonly results: readonly SearchResult[];
}

export interface RecentEntry {
  readonly ref: EntityRef;
  readonly visitedAt: string;
}
