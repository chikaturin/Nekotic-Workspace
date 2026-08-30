import type { AppNotification, Comment } from "./collab";

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed";

export type RealtimePayload =
  | { readonly type: "comment.created"; readonly targetKey: string; readonly comment: Comment }
  | { readonly type: "comment.updated"; readonly targetKey: string; readonly comment: Comment }
  | { readonly type: "notification.created"; readonly notification: AppNotification }
  | { readonly type: "notification.read"; readonly notificationIds: readonly string[] }
  | {
      readonly type: "permission.changed";
      readonly workspaceId: string;
      readonly nodeId: string | null;
      readonly userIds: readonly string[];
    };

export type RealtimeEventType = RealtimePayload["type"];

export interface RealtimeEvent {
  readonly id: string;
  readonly at: string;
  readonly origin: "local" | "remote";
  readonly payload: RealtimePayload;
}

export type RealtimeHandler = (event: RealtimeEvent) => void;

export interface RealtimeTransport {
  readonly name: string;
  readonly status: RealtimeStatus;
  connect: () => void;
  close: () => void;
  publish: (event: RealtimeEvent) => void;
  subscribe: (handler: RealtimeHandler) => () => void;
}
