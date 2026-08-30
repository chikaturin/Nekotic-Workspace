import { SEARCH_GROUP_LIMIT } from "@/config/app";
import { entityKindOf, nodeRef, rowRef } from "@/lib/entity-ref";
import { plainBody } from "@/lib/mentions";
import { lensesFor, titleOf } from "@/lib/my-work";
import { capabilitiesFor } from "@/lib/permissions";
import { matchesRowId } from "@/lib/row-id";
import { groupResults, scoreMatch, snippetAround } from "@/lib/search-index";
import { collectAllowed, pathLabel } from "@/lib/tree";
import { assertNoSimulatedListFailure, readDelay } from "@/services/backend";
import { boardFake } from "./board.fake";
import { collabFake } from "./collab.fake";
import { getActiveTree } from "@/store/workspace-store";
import {
  isDocument,
  isFile,
  type BoardNode,
  type DriveNode,
  type SearchGroup,
  type SearchResult,
  type SearchResultKind,
  type UserSummary,
  type WorkspaceRole,
} from "@/types";

/**
 * Global search (CO-SCH-31).
 *
 * Everything searchable is reachable from the drive tree, so permission is
 * applied once — at the node — and every result kind inherits it: a record
 * inside a board you cannot open is never scanned, and a comment on it is
 * never returned.
 */

/** A partial row-id match ranks above a title match but below an exact id. */
const ROW_ID_SCORE = 90;
/** Body and excerpt hits are weaker signals than a name hit. */
const BODY_WEIGHT = 0.4;

const TEMPLATE_KINDS: Readonly<Record<string, SearchResultKind>> = {
  apiDocs: "api",
  bug: "bug",
  qa: "qa",
};

export interface SearchInput {
  readonly query: string;
  readonly role: WorkspaceRole;
  readonly user: UserSummary;
  readonly limitPerGroup?: number;
}

async function search(
  { query, role, user, limitPerGroup = SEARCH_GROUP_LIMIT }: SearchInput,
  signal?: AbortSignal,
): Promise<readonly SearchGroup[]> {
  const needle = query.trim();
  if (needle.length === 0) return [];

  const tree = getActiveTree();

  // Permission is resolved once, with inheritance: a restricted folder takes
  // its whole subtree out of every result kind below.
  const visible = collectAllowed(
    tree,
    (node: DriveNode) => !node.isTrashed && capabilitiesFor({ role, user, node }).view,
  );

  const visibleNodeIds = new Set(visible.map((node) => node.id));
  const results: SearchResult[] = [];

  for (const node of visible) {
    const result = nodeResult(node, tree, needle);
    if (result) results.push(result);
  }

  await readDelay(signal);
  // Search is a read like any other: the simulation panel has to be able to
  // fail it, or the dialog's error state is a branch nothing can reach.
  assertNoSimulatedListFailure("search");

  const scan = await boardFake.scanBoards(
    { allow: (node: BoardNode) => visibleNodeIds.has(node.id) },
    signal,
  );

  for (const entry of scan) {
    const lenses = lensesFor(entry.board);
    const kind = TEMPLATE_KINDS[entry.board.templateId ?? ""] ?? "row";

    for (const row of entry.rows) {
      const title = titleOf(row, lenses);

      const idScore = matchesRowId(row.displayId, needle)
        ? Math.max(scoreMatch(row.displayId, needle), ROW_ID_SCORE)
        : 0;
      const score = Math.max(idScore, scoreMatch(title, needle));
      if (score === 0) continue;

      results.push({
        id: row.id,
        kind,
        title,
        subtitle: `${row.displayId} · ${entry.node.name}`,
        snippet: null,
        ref: rowRef({
          nodeId: entry.node.id,
          boardId: entry.board.id,
          rowId: row.id,
          label: row.displayId,
        }),
        score,
      });
    }
  }

  for (const comment of collabFake.allComments()) {
    if (!visibleNodeIds.has(comment.target.nodeId)) continue;

    const body = plainBody(comment.body);
    const score = scoreMatch(body, needle);
    if (score === 0) continue;

    results.push({
      id: comment.id,
      kind: "comment",
      title: `${comment.author.name} on ${comment.target.label}`,
      subtitle: comment.target.kind === "row" ? "Record comment" : "Page comment",
      snippet: snippetAround(body, needle),
      ref: comment.target,
      score: score * BODY_WEIGHT,
    });
  }

  return groupResults(results, limitPerGroup);
}

/** Documents and files also match on their excerpt, at a lower weight. */
function nodeResult(
  node: DriveNode,
  tree: readonly DriveNode[],
  needle: string,
): SearchResult | null {
  const kind: SearchResultKind = isDocument(node) ? "document" : isFile(node) ? "file" : "place";
  const nameScore = scoreMatch(node.name, needle);

  const body = isDocument(node) ? node.excerpt : isFile(node) ? node.excerpt ?? "" : "";
  const bodyScore = nameScore > 0 ? 0 : scoreMatch(body, needle) * BODY_WEIGHT;

  const score = Math.max(nameScore, bodyScore);
  if (score === 0) return null;

  return {
    id: node.id,
    kind,
    title: node.name,
    subtitle: `${labelForKind(node)} · ${pathLabel(tree, node.id)}`,
    snippet: bodyScore > 0 ? snippetAround(body, needle) : null,
    ref: nodeRef(node),
    score,
  };
}

function labelForKind(node: DriveNode): string {
  const kind = entityKindOf(node);
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export const searchFake = { search };
