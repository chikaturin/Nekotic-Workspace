import { MOCK_NOW } from "@/config/app";
import { memberAt } from "@/mock/users";
import type { UserSummary } from "@/types";

export type NotificationKind = "mention" | "share" | "comment" | "system";

export interface AppNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly actor: UserSummary;
  readonly message: string;
  /** Node this notification points at, when applicable. */
  readonly nodeId?: string;
  readonly createdAt: string;
  readonly isRead: boolean;
}

const HOUR_MS = 3_600_000;
const at = (hoursAgo: number) => new Date(new Date(MOCK_NOW).getTime() - hoursAgo * HOUR_MS).toISOString();

export const NOTIFICATIONS: readonly AppNotification[] = [
  {
    id: "ntf_1",
    kind: "mention",
    actor: memberAt(1),
    message: "mentioned you in Payment Sprint — “can you review the refund edge case?”",
    nodeId: "nd_development_backend_payment_payment_sprint",
    createdAt: at(1),
    isRead: false,
  },
  {
    id: "ntf_2",
    kind: "share",
    actor: memberAt(2),
    message: "shared payment-gateway-spec.pdf with the Backend group",
    nodeId: "nd_development_backend_payment_payment_gateway_spec_pdf",
    createdAt: at(3),
    isRead: false,
  },
  {
    id: "ntf_3",
    kind: "comment",
    actor: memberAt(3),
    message: "commented on webhook-flow.png — “retry arrow points the wrong way”",
    nodeId: "nd_development_backend_payment_webhook_flow_png",
    createdAt: at(6),
    isRead: false,
  },
  {
    id: "ntf_4",
    kind: "system",
    actor: memberAt(0),
    message: "Storage is at 52% of the team plan quota",
    createdAt: at(28),
    isRead: true,
  },
  {
    id: "ntf_5",
    kind: "share",
    actor: memberAt(4),
    message: "moved incident-2026-07.zip to Infrastructure",
    createdAt: at(52),
    isRead: true,
  },
] as const;

export const UNREAD_COUNT = NOTIFICATIONS.filter((item) => !item.isRead).length;
