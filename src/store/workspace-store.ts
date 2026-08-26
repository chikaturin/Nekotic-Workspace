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
import { extractTrashed, restoreTargetFor, trashNodeFrom, untrash } from "@/lib/trash";
import type { DocumentSummaryPatch } from "@/services/document-service";
import { createId, slugify, uniqueSlug } from "@/lib/utils";
import { CURRENT_USER } from "@/mock/users";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { DEFAULT_WORKSPACE_ID, WORKSPACES } from "@/mock/workspaces";
import {
  childrenOf,
  isContainer,
  isDocument,
  isFile,
  type BoardNode,
  type DocumentKind,
  type DocumentNode,
  type DriveNode,
  type FileAsset,
  type FileNode,
  type FolderNode,
  type SortState,
  type TrashEntry,
  type ViewMode,
  type Workspace,
} from "@/types";

/**
 * Deleting detaches (SY-TRH-38): the subtree leaves the tree and lives in the
 * bin until it is restored or purged. Nodes the dataset ships as deleted are
 * moved across at start-up, so there is one representation of "deleted" rather
 * than two that can disagree.
 */
function seedWorkspaces(): {
  readonly trees: Record<string, readonly DriveNode[]>;
  readonly bins: Record<string, readonly TrashEntry[]>;
} {
  const trees: Record<string, readonly DriveNode[]> = {};
  const bins: Record<string, readonly TrashEntry[]> = {};

  for (const [workspaceId, tree] of Object.entries(TREES_BY_WORKSPACE)) {
    // The seed carries no deletion record, so the node's own last-touched time
    // and owner stand in for it — never a clock read, which would desync SSR.
    const result = extractTrashed(tree, (node) => ({
      deletedAt: node.updatedAt,
      deletedBy: node.owner,
    }));

    trees[workspaceId] = result.tree;
    bins[workspaceId] = result.entries;
  }

  return { trees, bins };
}

const SEEDED = seedWorkspaces();

const DOCUMENT_LABELS: Readonly<Record<DocumentKind, string>> = {
  page: "page",
  config: "config",
  secret: "secret document",
};

export type FeedbackTone = "info" | "success" | "error";

export interface RowRequest {
  readonly nodeId: string;
  readonly rowId: string;
  /** Bumped every time, so asking for the same row twice still fires. */
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
  /** Soft-deleted subtrees, detached from the tree they came out of. */
  readonly trashByWorkspace: Readonly<Record<string, readonly TrashEntry[]>>;

  readonly expandedIds: readonly string[];
  readonly selectedIds: readonly string[];
  readonly viewMode: ViewMode;
  readonly sort: SortState;

  readonly previewNodeId: string | null;
  /**
   * A record the app has been asked to open, set when a notification, a search
   * hit or a My Work item routes to a board. The board consumes it after it
   * loads — the grid store is reset per board and cannot carry the intent.
   */
  readonly rowRequest: RowRequest | null;
  readonly isSidebarCollapsed: boolean;
  readonly isSearchOpen: boolean;
  readonly feedback: Feedback | null;

  /** Monotonic counter backing deterministic ids for created nodes. */
  readonly seed: number;
}

interface WorkspaceActions {
  setActiveWorkspace: (workspaceId: string) => void;

  toggleExpanded: (nodeId: string) => void;
  expandToNode: (nodeId: string) => void;
  collapseAll: () => void;

  setSelection: (nodeIds: readonly string[]) => void;
  toggleSelection: (nodeId: string, additive: boolean) => void;
  clearSelection: () => void;

  setViewMode: (mode: ViewMode) => void;
  setSort: (sort: SortState) => void;

  toggleFavorite: (nodeId: string) => void;
  renameNode: (nodeId: string, name: string) => void;
  createFolder: (parentId: string | null, name: string) => void;
  moveNode: (nodeId: string, targetParentId: string | null) => void;
  /** Archive or restore a project, folder, board or page (SY-ARC-37). */
  setNodeArchived: (nodeId: string, isArchived: boolean) => void;
  trashNode: (nodeId: string) => void;
  /** One state write for a multi-select delete, not one per item. */
  trashNodes: (nodeIds: readonly string[]) => void;
  restoreNode: (nodeId: string) => void;
  deleteForever: (nodeId: string) => void;
  emptyTrash: () => void;
  /** Insert a file that the upload service has already stored. */
  addUploadedAsset: (parentId: string | null, asset: FileAsset) => string;
  /** Create an empty page and return the node so the caller can navigate. */
  createDocument: (
    parentId: string | null,
    name: string,
    icon: string,
    documentKind?: DocumentKind,
  ) => DocumentNode | null;
  /** Create a board from a template and return the node for navigation. */
  createBoard: (parentId: string | null, name: string, templateId: string) => BoardNode | null;
  /** Copy a node (and its subtree) next to the original. */
  duplicateNode: (nodeId: string) => DriveNode | null;
  /** Mirror document content changes onto the tree summary. */
  applyDocumentSummary: (nodeId: string, patch: DocumentSummaryPatch) => void;
  /** Mirror a saved file edit onto the tree: new size, new version. */
  applyFileSave: (nodeId: string, sizeBytes: number) => void;

  openPreview: (nodeId: string) => void;
  closePreview: () => void;

  /** Ask the board at `nodeId` to open `rowId` in its drawer once it is ready. */
  requestRow: (nodeId: string, rowId: string) => void;
  clearRowRequest: () => void;

  toggleSidebar: () => void;
  /** Set directly — the responsive rail drives this, not a click. */
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  pushFeedback: (message: string, tone?: FeedbackTone) => void;
  dismissFeedback: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const INITIAL_SORT: SortState = { key: "name", direction: "asc" };

/** Root project of the mock tree starts open so the drive is never empty. */
const INITIAL_EXPANDED: readonly string[] = ["nd_development", "nd_development_backend"];

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  workspaces: WORKSPACES,
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  treeByWorkspace: SEEDED.trees,
  trashByWorkspace: SEEDED.bins,

  expandedIds: INITIAL_EXPANDED,
  selectedIds: [],
  viewMode: "grid",
  sort: INITIAL_SORT,

  previewNodeId: null,
  rowRequest: null,
  isSidebarCollapsed: false,
  isSearchOpen: false,
  feedback: null,
  seed: 0,

  setActiveWorkspace: (workspaceId) =>
    set((state) =>
      state.activeWorkspaceId === workspaceId
        ? state
        : { activeWorkspaceId: workspaceId, selectedIds: [], expandedIds: [] },
    ),

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

  toggleFavorite: (nodeId) =>
    set((state) => {
      const node = findNodeById(currentTree(state), nodeId);
      if (!node) return state;

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

      return writeTree(
        state,
        updateNode(currentTree(state), nodeId, (item) => ({
          ...item,
          name: trimmed,
          slug: slugify(trimmed),
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

  createFolder: (parentId, name) =>
    set((state) => {
      const tree = currentTree(state);
      const siblings = siblingsOf(tree, parentId);
      const slug = uniqueSlug(slugify(name), siblings.map((node) => node.slug));
      const nextSeed = state.seed + 1;

      const folder: FolderNode = {
        id: createId("new", nextSeed),
        name: name.trim() || "Untitled folder",
        slug,
        parentId,
        workspaceId: state.activeWorkspaceId,
        owner: CURRENT_USER,
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
        isFavorite: false,
        isTrashed: false,
        isShared: false,
        type: "folder",
        children: [],
      };

      return {
        ...writeTree(state, insertNode(tree, parentId, folder)),
        seed: nextSeed,
        feedback: makeFeedback(state, `Created folder “${folder.name}”`, "success"),
      };
    }),

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

      return {
        ...writeTree(state, result.tree),
        feedback: makeFeedback(
          state,
          `Moved “${result.moved?.name ?? "item"}” to ${targetName}`,
          "success",
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
          deletedBy: CURRENT_USER,
        });

        tree = result.tree;
        if (result.entry) added.push(result.entry);
      }

      if (added.length === 0) return state;

      const removed = new Set(added.map((entry) => entry.id));
      const first = added[0]!;

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

  /**
   * Put a deleted item back. Its original folder may itself have been purged
   * in the meantime — restoring then walks up to the deepest surviving
   * ancestor and *says so*, rather than dropping the item somewhere silently.
   */
  restoreNode: (nodeId) =>
    set((state) => {
      const bin = currentTrash(state);
      const entry = bin.find((candidate) => candidate.id === nodeId);
      if (!entry) return state;

      const tree = currentTree(state);
      const { parentId, isRelocated } = restoreTargetFor(tree, entry);
      const restored = untrash(entry.node, parentId);
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

  /** Permanent, whether the item is in the bin or still in the tree. */
  deleteForever: (nodeId) =>
    set((state) => {
      const bin = currentTrash(state);
      const entry = bin.find((candidate) => candidate.id === nodeId);

      if (entry) {
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

      return {
        ...writeTree(state, tree),
        feedback: makeFeedback(state, `Deleted “${removed.name}” permanently`, "error"),
      };
    }),

  emptyTrash: () =>
    set((state) => {
      const count = currentTrash(state).length;
      if (count === 0) return state;

      return {
        ...writeTrash(state, []),
        feedback: makeFeedback(state, `Deleted ${count} items permanently`, "error"),
      };
    }),

  addUploadedAsset: (parentId, asset) => {
    const state = get();
    const tree = currentTree(state);
    const taken = siblingsOf(tree, parentId).map((node) => node.slug);

    const node: FileNode = {
      id: asset.id,
      name: asset.name,
      slug: uniqueSlug(slugify(asset.name), taken),
      parentId,
      workspaceId: state.activeWorkspaceId,
      owner: asset.owner,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      isFavorite: false,
      isTrashed: false,
      isShared: false,
      type: "file",
      kind: asset.kind,
      extension: asset.extension,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      version: 1,
    };

    set(writeTree(state, insertNode(tree, parentId, node)));
    return node.id;
  },

  createDocument: (parentId, name, icon, documentKind = "page") => {
    const state = get();
    const tree = currentTree(state);

    if (parentId !== null) {
      const parent = findNodeById(tree, parentId);
      if (!parent || !isContainer(parent)) {
        set({ feedback: makeFeedback(state, "Pages can only live inside folders", "error") });
        return null;
      }
    }

    const taken = siblingsOf(tree, parentId).map((node) => node.slug);
    const nextSeed = state.seed + 1;
    const title = name.trim().length > 0 ? name.trim() : "Untitled";

    const node: DocumentNode = {
      id: createId("page", nextSeed),
      name: title,
      slug: uniqueSlug(slugify(title), taken),
      parentId,
      workspaceId: state.activeWorkspaceId,
      owner: CURRENT_USER,
      createdAt: MOCK_NOW,
      updatedAt: MOCK_NOW,
      isFavorite: false,
      isTrashed: false,
      isShared: false,
      type: "document",
      ...(documentKind === "page" ? {} : { documentKind }),
      icon,
      blockCount: 1,
      excerpt: "",
      isPinned: false,
      isLocked: false,
      isArchived: false,
    };

    set({
      ...writeTree(state, insertNode(tree, parentId, node)),
      seed: nextSeed,
      feedback: makeFeedback(state, `Created ${DOCUMENT_LABELS[documentKind]} “${node.name}”`, "success"),
    });

    return node;
  },

  /**
   * Boards are generated from a template. The template only supplies the
   * schema — the board owns its columns from the moment it exists.
   */
  createBoard: (parentId, name, templateId) => {
    const state = get();
    const tree = currentTree(state);

    if (parentId !== null) {
      const parent = findNodeById(tree, parentId);
      if (!parent || !isContainer(parent)) {
        set({ feedback: makeFeedback(state, "Boards can only live inside folders", "error") });
        return null;
      }
    }

    const taken = siblingsOf(tree, parentId).map((node) => node.slug);
    const nextSeed = state.seed + 1;
    const title = name.trim().length > 0 ? name.trim() : "Untitled board";

    const node: BoardNode = {
      id: createId("brd", nextSeed),
      name: title,
      slug: uniqueSlug(slugify(title), taken),
      parentId,
      workspaceId: state.activeWorkspaceId,
      owner: CURRENT_USER,
      createdAt: MOCK_NOW,
      updatedAt: MOCK_NOW,
      isFavorite: false,
      isTrashed: false,
      isShared: false,
      type: "board",
      boardKind: "table",
      templateId,
      itemCount: 0,
      openCount: 0,
    };

    set({
      ...writeTree(state, insertNode(tree, parentId, node)),
      seed: nextSeed,
      feedback: makeFeedback(state, `Created board “${node.name}”`, "success"),
    });

    return node;
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
                // The slug is the routing key and is minted once, at creation:
                // renaming a page the user is standing on must not break its URL.
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

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  pushFeedback: (message, tone = "info") =>
    set((state) => ({ feedback: makeFeedback(state, message, tone) })),

  dismissFeedback: () => set({ feedback: null }),
}));

/* ----------------------------------------------------------------- helpers */

function currentTree(state: WorkspaceState): readonly DriveNode[] {
  return state.treeByWorkspace[state.activeWorkspaceId] ?? [];
}

/** Replace the active workspace tree without touching the other workspaces. */
function writeTree(state: WorkspaceState, tree: readonly DriveNode[]) {
  return {
    treeByWorkspace: { ...state.treeByWorkspace, [state.activeWorkspaceId]: tree },
  };
}

function currentTrash(state: WorkspaceState): readonly TrashEntry[] {
  return state.trashByWorkspace[state.activeWorkspaceId] ?? [];
}

function writeTrash(state: WorkspaceState, entries: readonly TrashEntry[]) {
  return {
    trashByWorkspace: { ...state.trashByWorkspace, [state.activeWorkspaceId]: entries },
  };
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

/* --------------------------------------------------------------- selectors */

export const selectActiveWorkspace = (state: WorkspaceStore): Workspace =>
  state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ??
  (state.workspaces[0] as Workspace);

export const selectTree = (state: WorkspaceStore): readonly DriveNode[] =>
  state.treeByWorkspace[state.activeWorkspaceId] ?? [];

export const selectTrash = (state: WorkspaceStore): readonly TrashEntry[] =>
  state.trashByWorkspace[state.activeWorkspaceId] ?? [];

/** Badge count for the sidebar — a scalar, so it never re-renders the tree. */
export const selectTrashCount = (state: WorkspaceStore): number =>
  (state.trashByWorkspace[state.activeWorkspaceId] ?? []).length;

/** Tree of the active workspace, readable outside React. */
export function getActiveTree(): readonly DriveNode[] {
  const state = useWorkspaceStore.getState();
  return state.treeByWorkspace[state.activeWorkspaceId] ?? [];
}
