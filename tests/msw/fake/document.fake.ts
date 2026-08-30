import { VERSION_HISTORY_LIMIT } from "@/config/app";
import { documentLines } from "@/lib/blocks";
import { describeDiff, diffLines, summarizeDiff } from "@/lib/diff";
import { flattenTree } from "@/lib/tree";
import { contentForSlug } from "@/mock/document-content";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { CURRENT_USER } from "@/mock/users";
import {
  isDocument,
  type Block,
  type VersionEntry,
  type WorkspaceDocument,
} from "@/types";

/**
 * Backend giả cho tài liệu.
 *
 * Đây CHÍNH LÀ phần bụng của `document-service` cũ, chuyển nguyên sang đây.
 * Logic không mất đi — nó chỉ đổi phía: trước kia service vừa là client vừa là
 * server, giờ nó chỉ còn là client và phần server sống ở đây, sau một ranh giới
 * HTTP thật.
 *
 * Đồng bộ và KHÔNG có độ trễ giả: độ trễ thuộc về tầng vận chuyển, và MSW đã là
 * tầng đó.
 */

let store: Map<string, WorkspaceDocument> | null = null;
const versionsByNode = new Map<string, VersionEntry[]>();
const snapshots = new Map<string, readonly Block[]>();
let sequence = 0;

const nextId = (prefix: string): string =>
  `${prefix}_${(sequence += 1).toString(36)}`;

const nowIso = (): string => new Date().toISOString();

function catalog(): Map<string, WorkspaceDocument> {
  if (store) return store;

  const seeded = new Map<string, WorkspaceDocument>();

  for (const [workspaceId, tree] of Object.entries(TREES_BY_WORKSPACE)) {
    for (const node of flattenTree(tree)) {
      if (!isDocument(node)) continue;

      seeded.set(node.id, {
        id: `doc_${node.id}`,
        nodeId: node.id,
        workspaceId,
        title: node.name,
        icon: node.icon,
        blocks: contentForSlug(node.slug),
        isPinned: node.isPinned,
        isLocked: node.isLocked,
        lockedBy: node.isLocked ? node.owner : null,
        isArchived: node.isArchived,
        owner: node.owner,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        version: 1,
      });
    }
  }

  store = seeded;

  return seeded;
}

/**
 * Lịch sử phiên bản (SY-VER-39).
 *
 * Một phiên bản là ẢNH CHỤP, không phải delta, nên khôi phục không phải phát
 * lại một chuỗi. Khôi phục GHI THÊM một phiên bản mới thay vì tua ngược — bản
 * ghi chuyện đã xảy ra vẫn nguyên vẹn, và đó là toàn bộ lý do giữ nó.
 */
function versionsFor(document: WorkspaceDocument): VersionEntry[] {
  const existing = versionsByNode.get(document.nodeId);

  if (existing) return existing;

  const id = `${document.nodeId}_v1`;
  const seeded: VersionEntry[] = [
    {
      id,
      version: document.version,
      createdAt: document.updatedAt,
      author: document.owner,
      summary: `${documentLines(document.blocks).length} lines`,
      lines: documentLines(document.blocks),
      hasSnapshot: true,
    },
  ];

  snapshots.set(id, document.blocks);
  versionsByNode.set(document.nodeId, seeded);

  return seeded;
}

function pushVersion(
  previous: WorkspaceDocument,
  next: WorkspaceDocument,
): void {
  const history = versionsFor(previous);
  const diff = summarizeDiff(
    diffLines(documentLines(previous.blocks), documentLines(next.blocks)),
  );
  const id = nextId("docv");

  history.unshift({
    id,
    version: next.version,
    createdAt: next.updatedAt,
    author: CURRENT_USER,
    summary:
      previous.title === next.title
        ? describeDiff(diff)
        : `renamed · ${describeDiff(diff)}`,
    lines: documentLines(next.blocks),
    hasSnapshot: true,
  });

  snapshots.set(id, next.blocks);

  if (history.length > VERSION_HISTORY_LIMIT) {
    history.length = VERSION_HISTORY_LIMIT;
  }
}

export const documentFake = {
  find: (nodeId: string): WorkspaceDocument | null =>
    catalog().get(nodeId) ?? null,

  save: (
    nodeId: string,
    draft: {
      readonly title: string;
      readonly icon: string;
      readonly blocks: readonly Block[];
      readonly expectedVersion?: number;
    },
  ): { readonly document: WorkspaceDocument } | { readonly conflict: string } => {
    const current = catalog().get(nodeId);

    if (current === undefined) {
      // Node có thật nhưng chưa có nội dung: lần lưu đầu tiên LÀ lần tạo.
      const created: WorkspaceDocument = {
        id: `doc_${nodeId}`,
        nodeId,
        workspaceId: "ws_test",
        title: draft.title,
        icon: draft.icon,
        blocks: draft.blocks,
        isPinned: false,
        isLocked: false,
        lockedBy: null,
        isArchived: false,
        owner: CURRENT_USER,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        version: 1,
      };

      catalog().set(nodeId, created);

      return { document: created };
    }

    if (current.isLocked) {
      return { conflict: "This page is locked" };
    }

    if (
      draft.expectedVersion !== undefined &&
      draft.expectedVersion !== current.version
    ) {
      return { conflict: "This page changed while you were editing" };
    }

    const next: WorkspaceDocument = {
      ...current,
      title: draft.title.trim().length > 0 ? draft.title : "Untitled",
      icon: draft.icon,
      blocks: draft.blocks,
      updatedAt: nowIso(),
      version: current.version + 1,
    };

    catalog().set(nodeId, next);
    pushVersion(current, next);

    return { document: next };
  },

  setPinned: (nodeId: string, isPinned: boolean): WorkspaceDocument | null =>
    patch(nodeId, (document) => ({ ...document, isPinned })),

  setLocked: (nodeId: string, isLocked: boolean): WorkspaceDocument | null =>
    patch(nodeId, (document) => ({
      ...document,
      isLocked,
      lockedBy: isLocked ? CURRENT_USER : null,
    })),

  versions: (nodeId: string): readonly VersionEntry[] => {
    const document = catalog().get(nodeId);

    return document === undefined ? [] : versionsFor(document);
  },

  snapshot: (versionId: string): readonly Block[] | null =>
    snapshots.get(versionId) ?? null,

  reset: (): void => {
    store = null;
    versionsByNode.clear();
    snapshots.clear();
    sequence = 0;
  },
};

function patch(
  nodeId: string,
  update: (document: WorkspaceDocument) => WorkspaceDocument,
): WorkspaceDocument | null {
  const current = catalog().get(nodeId);

  if (current === undefined) return null;

  const next = { ...update(current), updatedAt: nowIso() };

  catalog().set(nodeId, next);

  return next;
}
