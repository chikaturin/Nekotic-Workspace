"use client";

import { create } from "zustand";
import { MOCK_NOW } from "@/config/app";
import { archiveLabelFor, isArchivedNode } from "@/lib/archive";
import {
  cloneNode,
  findNodeById,
  findPathToId,
  insertNode,
  moveNode as moveNodeInTree,
  removeNode,
  updateNode,
} from "@/lib/tree";
import { restoreTargetFor, trashNodeFrom, untrash } from "@/lib/trash";
import {
  moveVisibilityImpact,
  visibleTree,
  type VisibilityInput,
} from "@/lib/permissions/visibility";
import {
  isWorkspaceMember,
  visibleWorkspaces,
  withMember,
  withoutMember,
  workspaceAccess,
  type NewWorkspaceInput,
  type WorkspaceAccess,
} from "@/lib/workspace-access";
import type { CompletedUpload } from "@/services/api/file.api";
import { EMPTY_RULES, usePermissionStore } from "@/store/permission-store";
import { workspaceApi } from "@/services/api/workspace.api";
import { driveApi, type CreateNodeInput } from "@/services/api/drive.api";
import { fetchTree, writeThrough } from "@/store/drive-sync";
import type { DocumentSummaryPatch } from "@/services/document-service";
import { toAppError } from "@/services/errors";
import { createId, slugify, uniqueSlug } from "@/lib/utils";
import {
  childrenOf,
  isContainer,
  isDocument,
  isFile,
  type BoardNode,
  type DocumentKind,
  type DocumentNode,
  type DriveNode,
  type FileNode,
  type SortState,
  type NodeAccessMode,
  type TrashEntry,
  type ViewMode,
  type Workspace,
  type WorkspaceRole,
  type StorageQuota,
} from "@/types";
import { currentUser, currentUserId } from "@/store/session-store";

export type FeedbackTone = "info" | "success" | "error";

export interface RowRequest {
  readonly nodeId: string;
  readonly rowId: string;
  readonly nonce: number;
}

export interface Feedback {
  readonly id: number;
  readonly message: string;
  readonly tone: FeedbackTone;
}

interface WorkspaceState {
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string;
  readonly treeByWorkspace: Readonly<Record<string, readonly DriveNode[]>>;
  readonly trashByWorkspace: Readonly<Record<string, readonly TrashEntry[]>>;

  readonly expandedIds: readonly string[];
  readonly selectedIds: readonly string[];
  readonly viewMode: ViewMode;
  readonly sort: SortState;

  readonly previewNodeId: string | null;
  readonly rowRequest: RowRequest | null;
  readonly renameRequestId: string | null;
  readonly titleFocusNodeId: string | null;
  readonly isSidebarCollapsed: boolean;
  readonly isSearchOpen: boolean;
  readonly feedback: Feedback | null;

  readonly seed: number;
}

interface WorkspaceActions {
  setActiveWorkspace: (workspaceId: string) => boolean;
  clear: () => void;

  createWorkspace: (input: NewWorkspaceInput) => Promise<string | null>;
  updateWorkspace: (workspaceId: string, patch: Partial<NewWorkspaceInput>) => void;
  deleteWorkspace: (workspaceId: string) => void;

  createMemberAccount: (input: {
    readonly email: string;
    readonly name: string;
    readonly password: string;
    readonly role: WorkspaceRole;
  }) => Promise<boolean>;
  inviteMember: (email: string, role: WorkspaceRole) => Promise<boolean>;
  setMemberRole: (workspaceId: string, userId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  leaveWorkspace: (workspaceId: string, userId: string) => Promise<void>;

  setNodeAccessMode: (nodeId: string, mode: NodeAccessMode) => Promise<void>;

  toggleExpanded: (nodeId: string) => void;
  expandToNode: (nodeId: string) => void;
  collapseAll: () => void;

  setSelection: (nodeIds: readonly string[]) => void;
  toggleSelection: (nodeId: string, additive: boolean) => void;
  clearSelection: () => void;

  setViewMode: (mode: ViewMode) => void;
  setSort: (sort: SortState) => void;

  toggleFavorite: (nodeId: string) => void;
  togglePinned: (nodeId: string) => void;
  renameNode: (nodeId: string, name: string) => void;
  createFolder: (parentId: string | null, name: string) => Promise<void>;
  moveNode: (nodeId: string, targetParentId: string | null) => void;
  setNodeArchived: (nodeId: string, isArchived: boolean) => void;
  trashNode: (nodeId: string) => void;
  trashNodes: (nodeIds: readonly string[]) => void;
  restoreNode: (nodeId: string) => void;
  deleteForever: (nodeId: string) => void;
  emptyTrash: () => void;
  addUploadedAsset: (parentId: string | null, upload: CompletedUpload) => string;
  applyStorageUsage: (storage: StorageQuota) => void;
  forgetMissingNode: (nodeId: string) => void;
  createDocument: (
    parentId: string | null,
    name: string,
    icon: string,
    documentKind?: DocumentKind,
  ) => Promise<DocumentNode | null>;
  createBoard: (
    parentId: string | null,
    name: string,
    templateId: string,
  ) => Promise<BoardNode | null>;
  duplicateNode: (nodeId: string) => DriveNode | null;
  applyDocumentSummary: (nodeId: string, patch: DocumentSummaryPatch) => void;
  applyFileSave: (nodeId: string, sizeBytes: number) => void;

  openPreview: (nodeId: string) => void;
  closePreview: () => void;

  requestRow: (nodeId: string, rowId: string) => void;
  clearRowRequest: () => void;

  requestRename: (nodeId: string) => void;
  clearRenameRequest: () => void;

  requestTitleFocus: (nodeId: string) => void;
  clearTitleFocus: () => void;

  hydrate: (workspaceId?: string) => Promise<boolean>;
  hydrateWorkspaces: () => Promise<boolean>;

  toggleSidebar: () => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  pushFeedback: (message: string, tone?: FeedbackTone) => void;
  dismissFeedback: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const INITIAL_SORT: SortState = { key: "name", direction: "asc" };

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  workspaces: [],
  activeWorkspaceId: "",
  treeByWorkspace: {},
  trashByWorkspace: {},

  expandedIds: [],
  selectedIds: [],
  viewMode: "grid",
  sort: INITIAL_SORT,

  previewNodeId: null,
  rowRequest: null,
  renameRequestId: null,
  titleFocusNodeId: null,
  isSidebarCollapsed: false,
  isSearchOpen: false,
  feedback: null,
  seed: 0,

  setActiveWorkspace: (workspaceId) => {
    const state = get();
    if (state.activeWorkspaceId === workspaceId) return true;
    if (!isWorkspaceMember(state.workspaces.find((item) => item.id === workspaceId), currentUser().id)) {
      return false;
    }

    set({
      activeWorkspaceId: workspaceId,
      selectedIds: [],
      expandedIds: [],
      previewNodeId: null,
      rowRequest: null,
      renameRequestId: null,
      titleFocusNodeId: null,
    });

    return true;
  },

  clear: () => {
    set({
      workspaces: [],
      activeWorkspaceId: "",
      treeByWorkspace: {},
      trashByWorkspace: {},
      selectedIds: [],
      expandedIds: [],
      previewNodeId: null,
      rowRequest: null,
      renameRequestId: null,
      titleFocusNodeId: null,
      feedback: null,
    });
  },

  createWorkspace: async (input) => {
    try {
      const workspace = await workspaceApi.create({
        name: input.name.trim(),
        ...(input.description?.trim()
          ? { description: input.description.trim() }
          : {}),
      });

      set((state) => ({
        workspaces: [...state.workspaces, workspace],
        treeByWorkspace: { ...state.treeByWorkspace, [workspace.id]: [] },
        trashByWorkspace: { ...state.trashByWorkspace, [workspace.id]: [] },
        activeWorkspaceId: workspace.id,
        selectedIds: [],
        expandedIds: [],
        previewNodeId: null,
      }));

      return workspace.id;
    } catch (error) {
      set((state) => ({
        feedback: makeFeedback(state, toAppError(error).message, "error"),
      }));

      return null;
    }
  },

  updateWorkspace: (workspaceId, patch) =>
    set((state) => ({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              ...(patch.name?.trim() ? { name: patch.name.trim() } : {}),
              ...(patch.description !== undefined
                ? { description: patch.description.trim() }
                : {}),
              ...(patch.badge?.trim() ? { badge: patch.badge.trim().slice(0, 2).toUpperCase() } : {}),
              ...(patch.color ? { color: patch.color } : {}),
            }
          : workspace,
      ),
    })),

  deleteWorkspace: (workspaceId) =>
    set((state) => {
      const workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
      const trees = { ...state.treeByWorkspace };
      const bins = { ...state.trashByWorkspace };
      delete trees[workspaceId];
      delete bins[workspaceId];

      const mine = visibleWorkspaces(workspaces, currentUser().id);
      const nextActive =
        state.activeWorkspaceId === workspaceId
          ? mine[0]?.id ?? ""
          : state.activeWorkspaceId;

      return {
        workspaces,
        treeByWorkspace: trees,
        trashByWorkspace: bins,
        activeWorkspaceId: nextActive,
        selectedIds: [],
        expandedIds: [],
      };
    }),

  createMemberAccount: async (input) => {
    const workspaceId = get().activeWorkspaceId;
    if (workspaceId === "") return false;

    try {
      const member = await workspaceApi.createMemberAccount(workspaceId, input);

      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? withMember(workspace, member, member.role, member.joinedAt)
            : workspace,
        ),
      }));

      return true;
    } catch (error: unknown) {
      get().pushFeedback(toAppError(error).message, "error");

      return false;
    }
  },

  inviteMember: async (email, role) => {
    const workspaceId = get().activeWorkspaceId;
    if (workspaceId === "") return false;

    try {
      await workspaceApi.invite(workspaceId, email, role);

      return true;
    } catch (error: unknown) {
      get().pushFeedback(toAppError(error).message, "error");

      return false;
    }
  },

  setMemberRole: async (workspaceId, userId, role) => {
    const previous = get()
      .workspaces.find((workspace) => workspace.id === workspaceId)
      ?.members.find((member) => member.id === userId)?.role;

    const write = (next: WorkspaceRole) =>
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                members: workspace.members.map((member) =>
                  member.id === userId ? { ...member, role: next } : member,
                ),
              }
            : workspace,
        ),
      }));

    write(role);

    try {
      await workspaceApi.changeRole(workspaceId, userId, role);
    } catch (error: unknown) {
      if (previous !== undefined) write(previous);
      get().pushFeedback(toAppError(error).message, "error");
    }
  },

  removeMember: async (workspaceId, userId) => {
    const isSelf = userId === currentUserId();

    try {
      if (isSelf) await workspaceApi.leave(workspaceId);
      else await workspaceApi.removeMember(workspaceId, userId);
    } catch (error: unknown) {
      get().pushFeedback(toAppError(error).message, "error");

      return;
    }

    set((state) => {
      const workspaces = state.workspaces.map((workspace) =>
        workspace.id === workspaceId ? withoutMember(workspace, userId) : workspace,
      );

      if (!isSelf || state.activeWorkspaceId !== workspaceId) {
        return { workspaces };
      }

      const mine = visibleWorkspaces(workspaces, userId);

      return {
        workspaces,
        activeWorkspaceId: mine[0]?.id ?? "",
        selectedIds: [],
        expandedIds: [],
        previewNodeId: null,
        rowRequest: null,
      };
    });
  },

  leaveWorkspace: (workspaceId, userId) => get().removeMember(workspaceId, userId),

  setNodeAccessMode: async (nodeId, mode) => {
    const node = findNodeById(currentTree(get()), nodeId);

    try {
      await driveApi.setAccessMode(nodeId, mode);
    } catch (error: unknown) {
      get().pushFeedback(
        `Could not change who can see “${node?.name ?? "this item"}” — ${toAppError(error).message}`,
        "error",
      );

      return;
    }

    set((state) => ({
      ...writeTree(
        state,
        updateNode(currentTree(state), nodeId, (item) => ({ ...item, accessMode: mode })),
      ),
    }));
  },

  toggleExpanded: (nodeId) =>
    set((state) => ({
      expandedIds: state.expandedIds.includes(nodeId)
        ? state.expandedIds.filter((id) => id !== nodeId)
        : [...state.expandedIds, nodeId],
    })),

  expandToNode: (nodeId) =>
    set((state) => {
      const path = findPathToId(currentTree(state), nodeId);
      const ancestorIds = path.slice(0, -1).map((node) => node.id);
      const missing = ancestorIds.filter((id) => !state.expandedIds.includes(id));
      return missing.length === 0 ? state : { expandedIds: [...state.expandedIds, ...missing] };
    }),

  collapseAll: () => set({ expandedIds: [] }),

  setSelection: (nodeIds) => set({ selectedIds: [...nodeIds] }),

  toggleSelection: (nodeId, additive) =>
    set((state) => {
      if (!additive) return { selectedIds: [nodeId] };
      return {
        selectedIds: state.selectedIds.includes(nodeId)
          ? state.selectedIds.filter((id) => id !== nodeId)
          : [...state.selectedIds, nodeId],
      };
    }),

  clearSelection: () => set({ selectedIds: [] }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setSort: (sort) => set({ sort }),

  /**
   * Ghim khác Favorites: ghim là trạng thái CHUNG của node, ai trong workspace
   * cũng thấy nó trên thanh bên, nên nó đòi quyền sửa chứ không phải quyền xem.
   */
  togglePinned: (nodeId) =>
    set((state) => {
      const node = findNodeById(currentTree(state), nodeId);
      if (!node) return state;

      syncNodeChange(
        () => driveApi.pin(nodeId, !node.isPinned),
        nodeId,
        node,
        `Could not update “${node.name}”`,
      );

      return {
        ...writeTree(
          state,
          updateNode(currentTree(state), nodeId, (item) => ({
            ...item,
            isPinned: !item.isPinned,
          })),
        ),
        feedback: makeFeedback(
          state,
          node.isPinned ? `Unpinned “${node.name}”` : `Pinned “${node.name}”`,
          "info",
        ),
      };
    }),

  toggleFavorite: (nodeId) =>
    set((state) => {
      const node = findNodeById(currentTree(state), nodeId);
      if (!node) return state;

      syncNodeChange(
        () => driveApi.favorite(nodeId, !node.isFavorite),
        nodeId,
        node,
        `Could not update “${node.name}”`,
      );

      return {
        ...writeTree(state, updateNode(currentTree(state), nodeId, (item) => ({
          ...item,
          isFavorite: !item.isFavorite,
        }))),
        feedback: makeFeedback(
          state,
          node.isFavorite ? `Removed “${node.name}” from favorites` : `Added “${node.name}” to favorites`,
          "info",
        ),
      };
    }),

  renameNode: (nodeId, name) =>
    set((state) => {
      const trimmed = name.trim();
      if (trimmed.length === 0) return state;

      const tree = currentTree(state);
      const previous = findNodeById(tree, nodeId);

      if (previous !== null) {
        syncNodeChange(
          () => driveApi.update(nodeId, { name: trimmed }),
          nodeId,
          previous,
          `Could not rename “${previous.name}”`,
        );
      }

      const parentId = parentIdOf(tree, nodeId);
      const taken = siblingsOf(tree, parentId)
        .filter((sibling) => sibling.id !== nodeId)
        .map((sibling) => sibling.slug);

      return writeTree(
        state,
        updateNode(tree, nodeId, (item) => ({
          ...item,
          name: trimmed,
          slug: uniqueSlug(slugify(trimmed), taken),
          updatedAt: MOCK_NOW,
        })),
      );
    }),

  applyFileSave: (nodeId, sizeBytes) =>
    set((state) =>
      writeTree(
        state,
        updateNode(currentTree(state), nodeId, (item) =>
          isFile(item)
            ? { ...item, sizeBytes, version: item.version + 1, updatedAt: MOCK_NOW }
            : item,
        ),
      ),
    ),

  createFolder: async (parentId, name) => {
    const created = await createRemoteNode(get(), set, {
      kind: "folder",
      name: name.trim() || "Untitled folder",
      parentId,
    });

    if (created === null) return;

    set((state) => ({
      renameRequestId: created.id,
      feedback: makeFeedback(state, `Created folder “${created.name}”`, "success"),
    }));
  },

  moveNode: (nodeId, targetParentId) =>
    set((state) => {
      const tree = currentTree(state);
      const result = moveNodeInTree(tree, nodeId, targetParentId);

      if (result.rejection === "same-parent") return state;
      if (result.rejection) {
        return { feedback: makeFeedback(state, rejectionMessage(result.rejection), "error") };
      }

      const targetName = targetParentId
        ? (findNodeById(tree, targetParentId)?.name ?? "workspace root")
        : "workspace root";

      const moved = result.moved;
      const impact = moved
        ? moveVisibilityImpact(visibilityInputFor(state), moved, targetParentId)
        : { losing: [], gaining: [] };

      const note =
        impact.losing.length > 0
          ? ` — ${impact.losing.length} ${impact.losing.length === 1 ? "person" : "people"} can no longer see it`
          : impact.gaining.length > 0
            ? ` — now visible to ${impact.gaining.length} more`
            : "";

      return {
        ...writeTree(state, result.tree),
        feedback: makeFeedback(
          state,
          `Moved “${moved?.name ?? "item"}” to ${targetName}${note}`,
          impact.losing.length > 0 ? "info" : "success",
        ),
      };
    }),

  setNodeArchived: (nodeId, isArchived) =>
    set((state) => {
      const node = findNodeById(currentTree(state), nodeId);
      if (!node || isArchivedNode(node) === isArchived) return state;

      return {
        ...writeTree(
          state,
          updateNode(currentTree(state), nodeId, (item) => ({ ...item, isArchived })),
        ),
        feedback: makeFeedback(
          state,
          isArchived
            ? `Archived ${archiveLabelFor(node)} “${node.name}” — it is read-only until restored`
            : `Restored “${node.name}” from the archive`,
          isArchived ? "info" : "success",
        ),
      };
    }),

  trashNode: (nodeId) => get().trashNodes([nodeId]),

  trashNodes: (nodeIds) =>
    set((state) => {
      let tree = currentTree(state);
      const added: TrashEntry[] = [];

      for (const nodeId of nodeIds) {
        const result = trashNodeFrom(tree, nodeId, {
          deletedAt: MOCK_NOW,
          deletedBy: currentUser(),
        });

        tree = result.tree;
        if (result.entry) added.push(result.entry);
      }

      if (added.length === 0) return state;

      const removed = new Set(added.map((entry) => entry.id));
      const first = added[0]!;

      syncTrashChanges(
        added.map((entry) => () => driveApi.trash(entry.node.id)),
        added.length === 1
          ? `Could not move “${first.node.name}” to Trash`
          : `Could not move ${added.length} items to Trash`,
      );

      return {
        ...writeTree(state, tree),
        ...writeTrash(state, [...added, ...currentTrash(state)]),
        selectedIds: state.selectedIds.filter((id) => !removed.has(id)),
        feedback: makeFeedback(
          state,
          added.length === 1
            ? `Moved “${first.node.name}” to Trash`
            : `Moved ${added.length} items to Trash`,
          "info",
        ),
      };
    }),

  restoreNode: (nodeId) =>
    set((state) => {
      const bin = currentTrash(state);
      const entry = bin.find((candidate) => candidate.id === nodeId);
      if (!entry) return state;

      const tree = currentTree(state);
      const { parentId, isRelocated } = restoreTargetFor(tree, entry);
      const restored = untrash(entry.node, parentId);

      syncTrashChange(
        () => driveApi.restoreTrash(entry.id),
        `Could not restore “${restored.name}”`,
      );
      const location = parentId ? (findNodeById(tree, parentId)?.name ?? "Workspace") : "Workspace";

      return {
        ...writeTree(state, insertNode(tree, parentId, restored)),
        ...writeTrash(
          state,
          bin.filter((candidate) => candidate.id !== nodeId),
        ),
        feedback: makeFeedback(
          state,
          isRelocated
            ? `Restored “${restored.name}” to ${location} — its original folder no longer exists`
            : `Restored “${restored.name}” to ${location}`,
          isRelocated ? "info" : "success",
        ),
      };
    }),

  deleteForever: (nodeId) =>
    set((state) => {
      const bin = currentTrash(state);
      const entry = bin.find((candidate) => candidate.id === nodeId);

      if (entry) {
        syncTrashChange(
          () => driveApi.purgeTrash(entry.id),
          `Could not delete “${entry.node.name}” permanently`,
        );

        return {
          ...writeTrash(
            state,
            bin.filter((candidate) => candidate.id !== nodeId),
          ),
          feedback: makeFeedback(state, `Deleted “${entry.node.name}” permanently`, "error"),
        };
      }

      const { tree, removed } = removeNode(currentTree(state), nodeId);
      if (!removed) return state;

      syncTrashChange(
        () => driveApi.trash(nodeId),
        `Could not delete “${removed.name}” permanently`,
      );

      return {
        ...writeTree(state, tree),
        feedback: makeFeedback(state, `Deleted “${removed.name}” permanently`, "error"),
      };
    }),

  emptyTrash: () =>
    set((state) => {
      const count = currentTrash(state).length;
      if (count === 0) return state;

      syncTrashChange(
        () => driveApi.emptyTrash(state.activeWorkspaceId),
        "Could not empty the Trash",
      );

      return {
        ...writeTrash(state, []),
        feedback: makeFeedback(state, `Deleted ${count} items permanently`, "error"),
      };
    }),

  /**
   * Bỏ khỏi cây một mục mà server bảo là không còn/không được xem.
   *
   * Thanh điều hướng vẽ từ bản sao cây trong máy. Khi một mục bị xoá hoặc bị
   * khoá quyền ở nơi khác — phiên khác, người khác — bản sao này không tự biết:
   * tên vẫn nằm đó, bấm vào thì server trả 404, và người dùng nhìn thấy một
   * danh sách nói dối mình. Xoá nó ngay lúc phát hiện là cách rẻ nhất để thanh
   * điều hướng thôi hứa những thứ nó không mở được.
   */
  forgetMissingNode: (nodeId) => {
    const state = get();
    const tree = currentTree(state);

    if (findNodeById(tree, nodeId) === null) return;

    set(writeTree(state, removeNode(tree, nodeId).tree));
  },

  /**
   * Cập nhật hạn mức mà KHÔNG thêm gì vào cây.
   *
   * Dùng cho tệp nằm bên trong một ô, một khối hay một bình luận: nó vẫn ăn
   * dung lượng của workspace, nhưng không phải một mục trong Drive.
   */
  applyStorageUsage: (storage) => {
    const state = get();

    set({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === state.activeWorkspaceId ? { ...workspace, storage } : workspace,
      ),
    });
  },

  addUploadedAsset: (parentId, upload) => {
    const state = get();
    const tree = currentTree(state);
    const taken = siblingsOf(tree, parentId).map((node) => node.slug);
    const { asset } = upload;

    const node: FileNode = {
      id: upload.node?.id ?? asset.id,
      name: asset.name,
      slug: uniqueSlug(slugify(asset.name), taken),
      parentId,
      workspaceId: state.activeWorkspaceId,
      owner: asset.owner,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      isFavorite: false,
      isPinned: false,
      isTrashed: false,
      isShared: false,
      type: "file",
      kind: asset.kind,
      extension: asset.extension,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      ...(asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
      ...(asset.previewUrl ? { previewUrl: asset.previewUrl } : {}),
      version: 1,
    };

    set({
      ...writeTree(state, insertNode(tree, parentId, node)),
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === state.activeWorkspaceId
          ? { ...workspace, storage: upload.storage }
          : workspace,
      ),
    });

    return node.id;
  },

  createDocument: async (parentId, name, icon, documentKind = "page") => {
    if (!assertContainer(get(), set, parentId, "Pages can only live inside folders")) {
      return null;
    }

    const created = await createRemoteNode(get(), set, {
      kind: "document",
      name: name.trim().length > 0 ? name.trim() : "Untitled",
      parentId,
      documentKind,
    });

    if (created === null || created.type !== "document") return null;

    const node: DocumentNode = { ...created, icon };

    set((state) => ({
      ...writeTree(
        state,
        updateNode(currentTree(state), created.id, () => node),
      ),
      feedback: makeFeedback(state, `Created “${node.name}”`, "success"),
    }));

    return node;
  },

  createBoard: async (parentId, name, templateId) => {
    if (!assertContainer(get(), set, parentId, "Boards can only live inside folders")) {
      return null;
    }

    const created = await createRemoteNode(get(), set, {
      kind: "board",
      name: name.trim().length > 0 ? name.trim() : "Untitled board",
      parentId,
      boardKind: "table",
      templateId,
    });

    if (created === null || created.type !== "board") return null;

    set((state) => ({
      feedback: makeFeedback(state, `Created board “${created.name}”`, "success"),
    }));

    return created;
  },

  duplicateNode: (nodeId) => {
    const state = get();
    const tree = currentTree(state);

    const source = findNodeById(tree, nodeId);
    if (!source) return null;

    let seed = state.seed;
    const idFactory = () => {
      seed += 1;
      return createId("copy", seed);
    };

    const taken = siblingsOf(tree, source.parentId).map((node) => node.slug);
    const copyName = `${source.name} (copy)`;
    const clone = {
      ...cloneNode(source, source.parentId, idFactory),
      name: copyName,
      slug: uniqueSlug(slugify(copyName), taken),
    } as DriveNode;

    set({
      ...writeTree(state, insertNode(tree, source.parentId, clone)),
      seed,
      feedback: makeFeedback(state, `Duplicated “${source.name}”`, "success"),
    });

    return clone;
  },

  applyDocumentSummary: (nodeId, patch) =>
    set((state) => {
      const tree = currentTree(state);
      const node = findNodeById(tree, nodeId);
      if (!node || !isDocument(node)) return state;

      return writeTree(
        state,
        updateNode(tree, nodeId, (current) =>
          current.type === "document"
            ? {
                ...current,
                name: patch.name,
                icon: patch.icon,
                blockCount: patch.blockCount,
                excerpt: patch.excerpt,
                isPinned: patch.isPinned,
                isLocked: patch.isLocked,
                isArchived: patch.isArchived,
                updatedAt: patch.updatedAt,
              }
            : current,
        ),
      );
    }),

  openPreview: (nodeId) => set({ previewNodeId: nodeId }),
  closePreview: () => set({ previewNodeId: null }),

  requestRow: (nodeId, rowId) =>
    set((state) => ({
      rowRequest: { nodeId, rowId, nonce: (state.rowRequest?.nonce ?? 0) + 1 },
    })),

  clearRowRequest: () => set({ rowRequest: null }),

  requestRename: (nodeId) => set({ renameRequestId: nodeId }),
  clearRenameRequest: () => set({ renameRequestId: null }),

  requestTitleFocus: (nodeId) => set({ titleFocusNodeId: nodeId }),
  clearTitleFocus: () => set({ titleFocusNodeId: null }),

  hydrateWorkspaces: async () => {
    try {
      const workspaces = await workspaceApi.list();

      set((state) => ({
        workspaces,
        activeWorkspaceId: workspaces.some(
          (item) => item.id === state.activeWorkspaceId,
        )
          ? state.activeWorkspaceId
          : (workspaces[0]?.id ?? state.activeWorkspaceId),
      }));

      return true;
    } catch {
      return false;
    }
  },

  hydrate: async (workspaceId) => {
    const targetId = workspaceId ?? get().activeWorkspaceId;

    // Thùng rác đọc CÙNG LÚC với cây. Chỉ đọc cây thì sau mỗi lần F5, trang
    // Trash trống trơn dù server vẫn giữ nguyên các mục — và "Empty trash"
    // trên một danh sách rỗng thì chẳng xoá được gì.
    const [tree, bin] = await Promise.all([
      fetchTree(targetId),
      driveApi.listTrash(targetId).catch(() => null),
    ]);

    if (tree === null) return false;

    set((state) => ({
      treeByWorkspace: { ...state.treeByWorkspace, [targetId]: tree },
      ...(bin === null ? {} : { trashByWorkspace: { ...state.trashByWorkspace, [targetId]: bin } }),
    }));

    return true;
  },

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  pushFeedback: (message, tone = "info") =>
    set((state) => ({ feedback: makeFeedback(state, message, tone) })),

  dismissFeedback: () => set({ feedback: null }),
}));

async function createRemoteNode(
  state: WorkspaceStore,
  set: (partial: Partial<WorkspaceStore> | ((state: WorkspaceStore) => Partial<WorkspaceStore>)) => void,
  input: CreateNodeInput,
): Promise<DriveNode | null> {
  if (state.activeWorkspaceId === "") {
    set((current) => ({
      feedback: makeFeedback(
        current,
        "Tạo một workspace trước đã — mọi thứ đều nằm trong một workspace.",
        "error",
      ),
    }));

    return null;
  }

  try {
    const created = await driveApi.create(state.activeWorkspaceId, input);

    set((current) => ({
      ...writeTree(
        current,
        insertNode(currentTree(current), input.parentId, created),
      ),
    }));

    return created;
  } catch (error: unknown) {
    const appError = toAppError(error);

    set((current) => ({
      feedback: makeFeedback(
        current,
        `Could not create “${input.name}”: ${appError.message}`,
        "error",
      ),
    }));

    return null;
  }
}

function assertContainer(
  state: WorkspaceStore,
  set: (partial: Partial<WorkspaceStore>) => void,
  parentId: string | null,
  message: string,
): boolean {
  if (parentId === null) return true;

  const parent = findNodeById(currentTree(state), parentId);

  if (parent !== null && isContainer(parent)) return true;

  set({ feedback: makeFeedback(state, message, "error") });

  return false;
}

const EMPTY_NODES: readonly DriveNode[] = Object.freeze([]);
const EMPTY_TRASH: readonly TrashEntry[] = Object.freeze([]);
const EMPTY_MEMBERS: Workspace["members"] = Object.freeze([]);

function currentTree(state: WorkspaceState): readonly DriveNode[] {
  return state.treeByWorkspace[state.activeWorkspaceId] ?? EMPTY_NODES;
}

function visibilityInputFor(state: WorkspaceState): VisibilityInput {
  const workspace =
    state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId) ?? null;

  return {
    tree: currentTree(state),
    rules:
      usePermissionStore.getState().rulesByWorkspace[state.activeWorkspaceId] ??
      EMPTY_RULES,
    members: workspace?.members ?? EMPTY_MEMBERS,
    isMember: isWorkspaceMember(workspace, currentUserId()),
  };
}

/**
 * Bắn một thay đổi thùng rác lên server, và tải lại cây nếu nó hỏng.
 *
 * Xoá là thao tác PHÁ HUỶ, nên không thể chỉ đổi trong bộ nhớ rồi coi như xong:
 * người dùng bấm xoá, thấy nó biến mất, F5 và nó quay lại — mất niềm tin vào
 * mọi thứ khác trên màn hình. Ở đây không hoàn tác cục bộ mà đọc lại từ server,
 * vì dựng lại một nhánh cây đã gỡ đi chỉ đẻ thêm một phiên bản sự thật thứ hai.
 */
function syncTrashChange(call: () => Promise<unknown>, failureMessage: string): void {
  void writeThrough(call, {
    onRevert: (error) => {
      useWorkspaceStore.getState().pushFeedback(`${failureMessage} — ${error.message}`, "error");
      void useWorkspaceStore.getState().hydrate();
    },
  });
}

function syncTrashChanges(
  calls: readonly (() => Promise<unknown>)[],
  failureMessage: string,
): void {
  syncTrashChange(async () => {
    for (const call of calls) await call();
  }, failureMessage);
}

function syncNodeChange(
  call: () => Promise<DriveNode | void>,
  nodeId: string,
  previous: DriveNode,
  failureMessage: string,
): void {
  void writeThrough(call, {
    onSettled: (saved) => {
      if (saved === undefined) return;

      useWorkspaceStore.setState((state) => ({
        ...writeTree(
          state,
          updateNode(currentTree(state), nodeId, (node) => ({
            ...node,
            ...saved,
            ...("children" in node ? { children: childrenOf(node) } : {}),
          })),
        ),
      }));
    },
    onRevert: (error) => {
      useWorkspaceStore.setState((state) => ({
        ...writeTree(
          state,
          updateNode(currentTree(state), nodeId, () => previous),
        ),
        feedback: makeFeedback(state, `${failureMessage}: ${error.message}`, "error"),
      }));
    },
  });
}

function writeTree(state: WorkspaceState, tree: readonly DriveNode[]) {
  return {
    treeByWorkspace: { ...state.treeByWorkspace, [state.activeWorkspaceId]: tree },
  };
}

function currentTrash(state: WorkspaceState): readonly TrashEntry[] {
  return state.trashByWorkspace[state.activeWorkspaceId] ?? EMPTY_TRASH;
}

function writeTrash(state: WorkspaceState, entries: readonly TrashEntry[]) {
  return {
    trashByWorkspace: { ...state.trashByWorkspace, [state.activeWorkspaceId]: entries },
  };
}

function parentIdOf(tree: readonly DriveNode[], nodeId: string): string | null {
  const path = findPathToId(tree, nodeId);
  return path[path.length - 2]?.id ?? null;
}

function siblingsOf(tree: readonly DriveNode[], parentId: string | null): readonly DriveNode[] {
  if (parentId === null) return tree;
  const parent = findNodeById(tree, parentId);
  return parent ? childrenOf(parent) : [];
}

function makeFeedback(state: WorkspaceState, message: string, tone: FeedbackTone): Feedback {
  return { id: state.seed + Date.now(), message, tone };
}

function rejectionMessage(rejection: NonNullable<ReturnType<typeof moveNodeInTree>["rejection"]>): string {
  switch (rejection) {
    case "into-self":
      return "A folder cannot be moved into itself";
    case "into-descendant":
      return "A folder cannot be moved into one of its own subfolders";
    case "invalid-target":
      return "That destination cannot hold items";
    case "same-parent":
      return "Item is already in that folder";
  }
}

const NO_WORKSPACE: Workspace = {
  id: "",
  name: "No workspace",
  slug: "",
  plan: "free",
  badge: "—",
  color: "var(--kind-other)",
  members: [],
  storage: { usedBytes: 0, totalBytes: 0 },
};

export const selectActiveWorkspace = (state: WorkspaceStore): Workspace =>
  state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? NO_WORKSPACE;

export const selectMyWorkspaces = (state: WorkspaceStore): readonly Workspace[] =>
  visibleWorkspaces(state.workspaces, currentUserId());

export const selectWorkspaceAccess = (state: WorkspaceStore): WorkspaceAccess =>
  workspaceAccess(state.workspaces, state.activeWorkspaceId, currentUserId());

export const selectFullTree = (state: WorkspaceStore): readonly DriveNode[] =>
  state.treeByWorkspace[state.activeWorkspaceId] ?? EMPTY_NODES;

export const selectTree = (state: WorkspaceStore): readonly DriveNode[] =>
  visibleTreeFor(
    state.treeByWorkspace[state.activeWorkspaceId] ?? EMPTY_NODES,
    selectActiveWorkspace(state),
  );

interface TreeCacheKey {
  readonly tree: readonly DriveNode[];
  readonly rules: unknown;
  readonly members: unknown;
  readonly value: readonly DriveNode[];
}

let treeCache: TreeCacheKey | null = null;

export function visibleTreeFor(
  tree: readonly DriveNode[],
  workspace: Workspace,
): readonly DriveNode[] {
  const rules = usePermissionStore.getState().rulesByWorkspace[workspace.id] ?? EMPTY_RULES;

  if (
    treeCache &&
    treeCache.tree === tree &&
    treeCache.rules === rules &&
    treeCache.members === workspace.members
  ) {
    return treeCache.value;
  }

  const input: VisibilityInput = {
    tree,
    rules,
    members: workspace.members,
    isMember: isWorkspaceMember(workspace, currentUserId()),
  };

  const value = visibleTree(input, { kind: "user", userId: currentUserId() });
  treeCache = { tree, rules, members: workspace.members, value };
  return value;
}

export const selectTrash = (state: WorkspaceStore): readonly TrashEntry[] =>
  state.trashByWorkspace[state.activeWorkspaceId] ?? EMPTY_TRASH;

export const selectTrashCount = (state: WorkspaceStore): number =>
  (state.trashByWorkspace[state.activeWorkspaceId] ?? EMPTY_TRASH).length;

export function getActiveTree(): readonly DriveNode[] {
  return selectTree(useWorkspaceStore.getState());
}

export function getFullTree(): readonly DriveNode[] {
  return selectFullTree(useWorkspaceStore.getState());
}
