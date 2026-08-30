import { MOCK_NOW } from "@/config/app";
import { refKey, rowRef } from "@/lib/entity-ref";
import { extractMentionIds, mentionToken } from "@/lib/mentions";
import { CURRENT_USER, directoryAt } from "@/mock/users";
import type { AppNotification, Comment, EntityRef } from "@/types";

const HOUR_MS = 3_600_000;
const at = (hoursAgo: number) => new Date(Date.parse(MOCK_NOW) - hoursAgo * HOUR_MS).toISOString();

const SPRINT_NODE = "nd_development_backend_payment_payment_sprint";
const SPRINT_BOARD = `brd_${SPRINT_NODE}`;
const BUG_NODE = "nd_development_bug_tracker";
const BUG_BOARD = `brd_${BUG_NODE}`;
const API_NODE = "nd_development_api_catalogue";
const API_BOARD = `brd_${API_NODE}`;
const NOTES_NODE = "nd_development_backend_payment_payment_integration_notes";
const HANDBOOK_NODE = "nd_development_engineering_handbook";

export const SEED_REFS: Readonly<Record<string, EntityRef>> = {
  sprintTask4: rowRef({
    nodeId: SPRINT_NODE,
    boardId: SPRINT_BOARD,
    rowId: `${SPRINT_BOARD}_row_4`,
    label: "TASK-004",
  }),
  sprintTask11: rowRef({
    nodeId: SPRINT_NODE,
    boardId: SPRINT_BOARD,
    rowId: `${SPRINT_BOARD}_row_11`,
    label: "TASK-011",
  }),
  bug7: rowRef({
    nodeId: BUG_NODE,
    boardId: BUG_BOARD,
    rowId: `${BUG_BOARD}_row_7`,
    label: "BUG-007",
  }),
  api3: rowRef({
    nodeId: API_NODE,
    boardId: API_BOARD,
    rowId: `${API_BOARD}_row_3`,
    label: "API-003",
  }),
  paymentNotes: { kind: "document", nodeId: NOTES_NODE, label: "Payment Integration Notes" },
  handbook: { kind: "document", nodeId: HANDBOOK_NODE, label: "Engineering Handbook" },
  sprintBoard: { kind: "board", nodeId: SPRINT_NODE, label: "Payment Sprint" },
};

const mention = (index: number) => mentionToken(directoryAt(index));
const me = mentionToken(CURRENT_USER);

interface CommentSeed {
  readonly id: string;
  readonly ref: EntityRef;
  readonly parentId: string | null;
  readonly authorIndex: number;
  readonly body: string;
  readonly hoursAgo: number;
  readonly editedHoursAgo?: number;
}

const COMMENT_SEEDS: readonly CommentSeed[] = [
  {
    id: "cmt_seed_1",
    ref: SEED_REFS.sprintTask4!,
    parentId: null,
    authorIndex: 1,
    body: `${me} the retry budget here is still 5 attempts. Should we drop it to 3 before the release?`,
    hoursAgo: 4,
  },
  {
    id: "cmt_seed_2",
    ref: SEED_REFS.sprintTask4!,
    parentId: "cmt_seed_1",
    authorIndex: 2,
    body: "3 matches the provider's own backoff window, so 3 is safer. BUG-007 is the case that made us raise it.",
    hoursAgo: 3,
  },
  {
    id: "cmt_seed_3",
    ref: SEED_REFS.sprintTask4!,
    parentId: "cmt_seed_1",
    authorIndex: 0,
    body: `Agreed — dropping to 3. ${mention(3)} please re-run the reconciliation suite afterwards.`,
    hoursAgo: 2,
    editedHoursAgo: 1,
  },
  {
    id: "cmt_seed_4",
    ref: SEED_REFS.bug7!,
    parentId: null,
    authorIndex: 3,
    body: `Reproduced on staging. ${me} can you confirm the signature check is the one failing?`,
    hoursAgo: 9,
  },
  {
    id: "cmt_seed_5",
    ref: SEED_REFS.paymentNotes!,
    parentId: null,
    authorIndex: 2,
    body: "The idempotency section needs the new header name before this goes out to partners.",
    hoursAgo: 6,
  },
  {
    id: "cmt_seed_6",
    ref: SEED_REFS.api3!,
    parentId: null,
    authorIndex: 4,
    body: `${me} this endpoint is duplicated with API-017. One of them should be retired.`,
    hoursAgo: 20,
  },
];

export function seedComments(): Map<string, Comment[]> {
  const byTarget = new Map<string, Comment[]>();

  for (const seed of COMMENT_SEEDS) {
    const key = refKey(seed.ref);
    const createdAt = at(seed.hoursAgo);

    const comment: Comment = {
      id: seed.id,
      targetKey: key,
      target: seed.ref,
      parentId: seed.parentId,
      author: directoryAt(seed.authorIndex),
      body: seed.body,
      mentionedUserIds: extractMentionIds(seed.body),
      attachments: [],
      createdAt,
      updatedAt: seed.editedHoursAgo === undefined ? createdAt : at(seed.editedHoursAgo),
      isEdited: seed.editedHoursAgo !== undefined,
    };

    const bucket = byTarget.get(key);
    if (bucket) bucket.push(comment);
    else byTarget.set(key, [comment]);
  }

  return byTarget;
}

export const SEED_WATCHES: readonly EntityRef[] = [
  SEED_REFS.sprintTask4!,
  SEED_REFS.paymentNotes!,
  SEED_REFS.sprintBoard!,
];

interface NotificationSeed {
  readonly id: string;
  readonly reason: AppNotification["reason"];
  readonly actorIndex: number;
  readonly title: string;
  readonly body: string;
  readonly ref: EntityRef | null;
  readonly hoursAgo: number;
  readonly isRead?: boolean;
}

const NOTIFICATION_SEEDS: readonly NotificationSeed[] = [
  {
    id: "ntf_seed_1",
    reason: "mention",
    actorIndex: 1,
    title: "Mai Tran mentioned you",
    body: "the retry budget here is still 5 attempts. Should we drop it to 3 before the release?",
    ref: SEED_REFS.sprintTask4!,
    hoursAgo: 4,
  },
  {
    id: "ntf_seed_2",
    reason: "mention",
    actorIndex: 3,
    title: "Lan Nguyen mentioned you",
    body: "Reproduced on staging. Can you confirm the signature check is the one failing?",
    ref: SEED_REFS.bug7!,
    hoursAgo: 9,
  },
  {
    id: "ntf_seed_3",
    reason: "assigned",
    actorIndex: 2,
    title: "Duc Pham assigned you TASK-011",
    body: "Harden the webhook signature verification before the provider cutover.",
    ref: SEED_REFS.sprintTask11!,
    hoursAgo: 7,
  },
  {
    id: "ntf_seed_4",
    reason: "assigned",
    actorIndex: 1,
    title: "Mai Tran assigned you API-003",
    body: "Document the auth requirements for the refund endpoint.",
    ref: SEED_REFS.api3!,
    hoursAgo: 21,
  },
  {
    id: "ntf_seed_5",
    reason: "comment",
    actorIndex: 2,
    title: "New reply on TASK-004",
    body: "3 matches the provider's own backoff window, so 3 is safer.",
    ref: SEED_REFS.sprintTask4!,
    hoursAgo: 3,
  },
  {
    id: "ntf_seed_6",
    reason: "watch",
    actorIndex: 4,
    title: "Payment Integration Notes was updated",
    body: "Hai Vo edited the idempotency section you follow.",
    ref: SEED_REFS.paymentNotes!,
    hoursAgo: 6,
    isRead: true,
  },
  {
    id: "ntf_seed_7",
    reason: "system",
    actorIndex: 0,
    title: "Storage is at 52% of the team plan",
    body: "Archive the 2026 incident bundles to free the largest share.",
    ref: null,
    hoursAgo: 28,
    isRead: true,
  },
];

export function seedNotifications(): readonly AppNotification[] {
  return NOTIFICATION_SEEDS.map((seed) => ({
    id: seed.id,
    reason: seed.reason,
    recipientId: CURRENT_USER.id,
    actor: directoryAt(seed.actorIndex),
    title: seed.title,
    body: seed.body,
    target: seed.ref,
    createdAt: at(seed.hoursAgo),
    isRead: seed.isRead ?? false,
  }));
}
