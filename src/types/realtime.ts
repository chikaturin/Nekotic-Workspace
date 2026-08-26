import type { AppNotification, Comment } from "./collab";

/**
 * Realtime is expressed as a transport interface, not as a socket client.
 *
 * The backend does not expose a realtime endpoint yet, so the only transport
 * wired today is the in-process one. When a socket does land, it implements
 * this interface and `createTransport` returns it — nothing above this line
 * changes.
 */

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed";

/** What a realtime frame can carry. Additive: unknown types are ignored. */
export type RealtimePayload =
  | { readonly type: "comment.created"; readonly targetKey: string; readonly comment: Comment }
  | { readonly type: "comment.updated"; readonly targetKey: string; readonly comment: Comment }
  | { readonly type: "notification.created"; readonly notification: AppNotification }
  | { readonly type: "notification.read"; readonly notificationIds: readonly string[] };

export type RealtimeEventType = RealtimePayload["type"];

export interface RealtimeEvent {
  /** Delivery identity. The client drops a repeat of an id it has already seen. */
  readonly id: string;
  readonly at: string;
  /** `local` when this tab produced it, `remote` when the transport delivered it. */
  readonly origin: "local" | "remote";
  readonly payload: RealtimePayload;
}

export type RealtimeHandler = (event: RealtimeEvent) => void;

export interface RealtimeTransport {
  /** Shown in diagnostics so it is obvious which transport is live. */
  readonly name: string;
  readonly status: RealtimeStatus;
  connect: () => void;
  close: () => void;
  /** Send a frame. The local transport echoes it back to its own subscribers. */
  publish: (event: RealtimeEvent) => void;
  subscribe: (handler: RealtimeHandler) => () => void;
}
