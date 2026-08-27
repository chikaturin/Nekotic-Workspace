import { beforeEach, describe, expect, test } from "vitest";
import { groupResults, scoreMatch, snippetAround, totalResults } from "@/lib/search-index";
import { refKey, rowRef } from "@/lib/entity-ref";
import { board, doc, file, folder, hydrate, project, type NodeSpec } from "@/mock/factory";
import { boardIdFor, boardService } from "@/services/board-service";
import { commentService } from "@/services/comment-service";
import { notificationService } from "@/services/notification-service";
import { searchService } from "@/services/search-service";
import { watchService } from "@/services/watch-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { CURRENT_USER } from "@/mock/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode, SearchGroup, SearchResult, SearchResultKind } from "@/types";

import { testWorkspace } from "./helpers";

const WORKSPACE_ID = "ws_search";

const ID = {
  platform: "s_platform",
  playbook: "s_platform_refund_playbook",
  apiBoard: "s_platform_api_directory",
  bugBoard: "s_platform_defect_log",
  notes: "s_platform_refund_notes_md",
  vault: "s_platform_vault",
  vaultFile: "s_platform_vault_refund_secrets_md",
} as const;

/** A small forest with one restricted subtree, owned by somebody else. */
function buildSearchTree(): readonly DriveNode[] {
  const specs: readonly NodeSpec[] = [
    project({
      name: "Platform",
      color: "var(--kind-code)",
      updatedHoursAgo: 1,
      children: [
        doc({
          name: "Refund Playbook",
          icon: "📄",
          blockCount: 3,
          excerpt: "Reconciling a partially captured charge, step by step.",
          updatedHoursAgo: 2,
        }),
        board({
          name: "API Directory",
          boardKind: "table",
          templateId: "apiDocs",
          itemCount: 6,
          openCount: 1,
        }),
        board({
          name: "Defect Log",
          boardKind: "table",
          templateId: "bug",
          itemCount: 4,
          openCount: 1,
        }),
        file({ name: "refund-notes.md", sizeBytes: 120, updatedHoursAgo: 3 }),
        folder({
          name: "Vault",
          restricted: true,
          ownerIndex: 3,
          updatedHoursAgo: 5,
          children: [file({ name: "refund-secrets.md", sizeBytes: 40, updatedHoursAgo: 5 })],
        }),
      ],
    }),
  ];

  return hydrate(specs, { workspaceId: WORKSPACE_ID, parentId: null, idPrefix: "s" });
}

function search(query: string) {
  return searchService.search({ query, role: "member", user: CURRENT_USER });
}

function kinds(groups: readonly SearchGroup[]): readonly SearchResultKind[] {
  return groups.map((group) => group.kind);
}

function flat(groups: readonly SearchGroup[]): readonly SearchResult[] {
  return groups.flatMap((group) => group.results);
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  boardService.reset();
  commentService.reset();
  notificationService.reset();
  watchService.reset();

  useWorkspaceStore.setState({
    workspaces: [testWorkspace(WORKSPACE_ID)],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildSearchTree() },
    feedback: null,
    seed: 0,
  });
});

describe("ranking", () => {
  test("an exact hit beats a prefix, which beats a word start, which beats a substring", () => {
    expect(scoreMatch("refund", "refund")).toBeGreaterThan(scoreMatch("refund policy", "refund"));
    expect(scoreMatch("refund policy", "refund")).toBeGreaterThan(scoreMatch("a refund", "refund"));
    expect(scoreMatch("a refund", "refund")).toBeGreaterThan(scoreMatch("prefunded", "refund"));
    expect(scoreMatch("anything", "  ")).toBe(0);
    expect(scoreMatch("anything", "missing")).toBe(0);
  });

  test("a snippet frames the match", () => {
    const text = `${"a".repeat(80)} needle ${"b".repeat(80)}`;
    const snippet = snippetAround(text, "needle", 10);

    expect(snippet).toContain("needle");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  test("groups keep the declared order and cap each bucket", () => {
    const make = (id: string, kind: SearchResultKind, score: number): SearchResult => ({
      id,
      kind,
      title: id,
      subtitle: "",
      snippet: null,
      ref: { kind: "document", nodeId: id, label: id },
      score,
    });

    const groups = groupResults(
      [
        make("f1", "file", 10),
        make("d1", "document", 10),
        make("d2", "document", 90),
        make("d3", "document", 50),
      ],
      2,
    );

    expect(kinds(groups)).toEqual(["document", "file"]);
    expect(groups[0]?.results.map((result) => result.id)).toEqual(["d2", "d3"]);
    expect(totalResults(groups)).toBe(3);
  });
});

describe("global search", () => {
  test("an empty query searches nothing", async () => {
    expect(await search("   ")).toEqual([]);
  });

  test("documents, files and places come back in their own groups", async () => {
    const groups = await search("refund");
    const ids = flat(groups).map((result) => result.ref.nodeId);

    expect(kinds(groups)).toContain("document");
    expect(kinds(groups)).toContain("file");
    expect(ids).toContain(ID.playbook);
    expect(ids).toContain(ID.notes);
  });

  test("a restricted folder hides itself and everything under it", async () => {
    const ids = flat(await search("refund")).map((result) => result.ref.nodeId);

    expect(ids).not.toContain(ID.vault);
    // The file itself carries no restriction — it inherits the folder's.
    expect(ids).not.toContain(ID.vaultFile);
  });

  test("a record id finds its record, typed loosely or exactly", async () => {
    const exact = flat(await search("API-003"));
    expect(exact[0]?.kind).toBe("api");
    expect(exact[0]?.ref.rowId).toBe(`${boardIdFor(ID.apiBoard)}_row_3`);

    const loose = flat(await search("api 3"));
    expect(loose.some((result) => result.ref.rowId === `${boardIdFor(ID.apiBoard)}_row_3`)).toBe(
      true,
    );
  });

  test("records are bucketed by the template their board came from", async () => {
    const api = flat(await search("API-001"));
    const bug = flat(await search("BUG-001"));

    expect(api[0]?.kind).toBe("api");
    expect(bug[0]?.kind).toBe("bug");
  });

  test("a record's title is searchable, not just its id", async () => {
    const snapshot = await boardService.getBoard(ID.apiBoard);
    const first = snapshot.rows[0]!;
    const endpoint = first.cells[snapshot.board.primaryColumnId];
    const path = endpoint && endpoint.kind === "text" ? endpoint.value : "";

    expect(path.length).toBeGreaterThan(0);

    const hits = flat(await search(path));
    expect(hits.some((result) => result.ref.rowId === first.id)).toBe(true);
  });

  test("comments are searchable and route back to their target", async () => {
    const snapshot = await boardService.getBoard(ID.apiBoard);
    const row = snapshot.rows[0]!;
    const target = rowRef({
      nodeId: ID.apiBoard,
      boardId: snapshot.board.id,
      rowId: row.id,
      label: row.displayId,
    });

    await commentService.add({ target, body: "The idempotency header is misspelled here." });

    const groups = await search("idempotency header");
    const comments = groups.find((group) => group.kind === "comment");

    expect(comments?.results).toHaveLength(1);
    expect(comments?.results[0]?.snippet).toContain("idempotency header");
    expect(refKey(comments!.results[0]!.ref)).toBe(refKey(target));
  });

  test("a comment on a restricted target is not returned", async () => {
    const target = { kind: "document", nodeId: ID.vaultFile, label: "refund-secrets.md" } as const;
    await commentService.add({ target, body: "rotation window is Friday" });

    expect(await search("rotation window")).toEqual([]);
  });
});

describe("search failure", () => {
  test("a failing backend rejects rather than answering “nothing matches”", async () => {
    // The dialog distinguishes the two; the service has to give it something
    // to distinguish. Silently returning no results is the worst answer a
    // search box can give, because it looks like a fact about the workspace.
    setSimulation({ listFailure: "network" });

    await expect(
      searchService.search({ query: "payment", role: "admin", user: CURRENT_USER }),
    ).rejects.toThrow();

    resetSimulation();
  });
});
