import { documentExcerpt } from "@/lib/blocks";
import { flattenTree } from "@/lib/tree";
import { contentForSlug } from "@/mock/document-content";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import {
  assertNoSimulatedListFailure,
  nextId,
  nowIso,
  readDelay,
  writeDelay,
} from "@/services/backend";
import { conflict, notFound, ServiceError, appError } from "@/services/errors";
import { shouldFailSave } from "@/services/simulation";
import { isDocument, type Block, type DocumentDraft, type WorkspaceDocument } from "@/types";

/**
 * In-memory stand-in for the documents API. Content lives here, never in the
 * drive tree — the tree only carries the summary shown in listings.
 */
let store: Map<string, WorkspaceDocument> | null = null;

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

function mustFind(nodeId: string): WorkspaceDocument {
  const document = catalog().get(nodeId);
  if (!document) throw notFound("That document");
  return document;
}

function commit(document: WorkspaceDocument): WorkspaceDocument {
  catalog().set(document.nodeId, document);
  return document;
}

/** Summary the drive tree keeps in sync with the document content. */
export interface DocumentSummaryPatch {
  readonly name: string;
  readonly icon: string;
  readonly blockCount: number;
  readonly excerpt: string;
  readonly isPinned: boolean;
  readonly isLocked: boolean;
  readonly isArchived: boolean;
  readonly updatedAt: string;
}

export function summarize(document: WorkspaceDocument): DocumentSummaryPatch {
  return {
    name: document.title,
    icon: document.icon,
    blockCount: document.blocks.length,
    excerpt: documentExcerpt(document.blocks, 120),
    isPinned: document.isPinned,
    isLocked: document.isLocked,
    isArchived: document.isArchived,
    updatedAt: document.updatedAt,
  };
}

async function get(nodeId: string, signal?: AbortSignal): Promise<WorkspaceDocument> {
  await readDelay(signal);
  assertNoSimulatedListFailure("this page");

  return mustFind(nodeId);
}

/**
 * Persist a draft. Rejects when the document is locked, so a stale editor can
 * never write over a page somebody froze.
 */
async function save(
  nodeId: string,
  draft: DocumentDraft,
  signal?: AbortSignal,
): Promise<WorkspaceDocument> {
  await writeDelay(signal);

  const current = mustFind(nodeId);
  if (current.isLocked) {
    throw conflict("This page is locked", "Unlock it before saving further changes.");
  }

  if (shouldFailSave(draft.title)) {
    throw new ServiceError(
      appError("network", "Changes could not be saved", {
        detail: "Simulated save failure — remove “fail” from the title or reset the simulation.",
        isRetryable: true,
      }),
    );
  }

  return commit({
    ...current,
    title: draft.title.trim().length > 0 ? draft.title : "Untitled",
    icon: draft.icon,
    blocks: draft.blocks,
    updatedAt: nowIso(),
    version: current.version + 1,
  });
}

async function setPinned(nodeId: string, isPinned: boolean): Promise<WorkspaceDocument> {
  await writeDelay();
  return commit({ ...mustFind(nodeId), isPinned, updatedAt: nowIso() });
}

async function setLocked(
  nodeId: string,
  isLocked: boolean,
  lockedBy: WorkspaceDocument["lockedBy"],
): Promise<WorkspaceDocument> {
  await writeDelay();
  return commit({
    ...mustFind(nodeId),
    isLocked,
    lockedBy: isLocked ? lockedBy : null,
    updatedAt: nowIso(),
  });
}

async function setArchived(nodeId: string, isArchived: boolean): Promise<WorkspaceDocument> {
  await writeDelay();
  return commit({ ...mustFind(nodeId), isArchived, updatedAt: nowIso() });
}

/** Copy a document onto a brand-new node id, with fresh block ids. */
async function duplicate(
  sourceNodeId: string,
  targetNodeId: string,
  title: string,
): Promise<WorkspaceDocument> {
  await writeDelay();

  const source = mustFind(sourceNodeId);
  const blocks: readonly Block[] = source.blocks.map((block) => ({ ...block, id: nextId("blk") }));

  return commit({
    ...source,
    id: `doc_${targetNodeId}`,
    nodeId: targetNodeId,
    title,
    blocks,
    isPinned: false,
    isLocked: false,
    lockedBy: null,
    isArchived: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: 1,
  });
}

/** Create an empty document for a node that was just added to the tree. */
async function create(input: {
  nodeId: string;
  workspaceId: string;
  title: string;
  icon: string;
  owner: WorkspaceDocument["owner"];
  blocks: readonly Block[];
}): Promise<WorkspaceDocument> {
  await writeDelay();

  return commit({
    id: `doc_${input.nodeId}`,
    nodeId: input.nodeId,
    workspaceId: input.workspaceId,
    title: input.title,
    icon: input.icon,
    blocks: input.blocks,
    isPinned: false,
    isLocked: false,
    lockedBy: null,
    isArchived: false,
    owner: input.owner,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: 1,
  });
}

async function remove(nodeId: string): Promise<void> {
  await writeDelay();
  catalog().delete(nodeId);
}

/** Test seam — drops the in-memory catalog so it re-seeds from the mock tree. */
function reset(): void {
  store = null;
}

export const documentService = {
  get,
  save,
  create,
  duplicate,
  setPinned,
  setLocked,
  setArchived,
  remove,
  summarize,
  reset,
};
