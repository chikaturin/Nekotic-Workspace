"use client";

import { create } from "zustand";
import { MOCK_NOW } from "@/config/app";
import {
  cloneNode,
  findNodeById,
  findPathToId,
  insertNode,
  moveNode as moveNodeInTree,
  removeNode,
  updateNode,
} from "@/lib/tree";
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
  type ViewMode,
  type Workspace,
} from "@/types";

const DOCUMENT_LABELS: Readonly<Record<DocumentKind, string>> = {
  page: "page",
  config: "config",
  secret: "secret document",
};

export type FeedbackTone = "info" | "success" | "error";

export interface Feedback {
  readonly id: number;
  readonly message: string;
  readonly tone: FeedbackTone;
}

interface WorkspaceState {
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string;
  readonly treeByWorkspace: Readonly<Record<string, readonly DriveNode[]>>;

  readonly expandedIds: readonly string[];
  readonly selectedIds: readonly string[];
  readonly viewMode: ViewMode;
  readonly sort: SortState;

  readonly previewNodeId: string | null;
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
  trashNode: (nodeId: string) => void;
  restoreNode: (nodeId: string) => void;
  deleteForever: (nodeId: string) => void;
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

  toggleSidebar: () => void;
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
  treeByWorkspace: TREES_BY_WORKSPACE,

  expandedIds: INITIAL_EXPANDED,
  selectedIds: [],
  viewMode: "grid",
  sort: INITIAL_SORT,

  previewNodeId: null,
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

  trashNode: (nodeId) =>
    set((state) => {
      const node = findNodeById(currentTree(state), nodeId);
      if (!node) return state;

      return {
        ...writeTree(
          state,
          updateNode(currentTree(state), nodeId, (item) => ({ ...item, isTrashed: true })),
        ),
        selectedIds: state.selectedIds.filter((id) => id !== nodeId),
        feedback: makeFeedback(state, `Moved “${node.name}” to Trash`, "info"),
      };
    }),

  restoreNode: (nodeId) =>
    set((state) =>
      writeTree(
        state,
        updateNode(currentTree(state), nodeId, (item) => ({ ...item, isTrashed: false })),
      ),
    ),

  deleteForever: (nodeId) =>
    set((state) => {
      const { tree, removed } = removeNode(currentTree(state), nodeId);
      if (!removed) return state;

      return {
        ...writeTree(state, tree),
        feedback: makeFeedback(state, `Deleted “${removed.name}” permanently`, "error"),
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

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
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

/** Tree of the active workspace, readable outside React. */
export function getActiveTree(): readonly DriveNode[] {
  const state = useWorkspaceStore.getState();
  return state.treeByWorkspace[state.activeWorkspaceId] ?? [];
}
