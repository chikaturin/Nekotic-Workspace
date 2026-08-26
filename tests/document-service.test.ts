import { beforeEach, describe, expect, test } from "vitest";
import { flattenTree } from "@/lib/tree";
import { NEXDROP_TREE } from "@/mock/tree";
import { CURRENT_USER, memberAt } from "@/mock/users";
import { documentService } from "@/services/document-service";
import { isServiceError } from "@/services/errors";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { isDocument, type Block } from "@/types";

/** Resolve a seeded document node by name so ids stay an implementation detail. */
function nodeIdByName(name: string): string {
  const node = flattenTree(NEXDROP_TREE).find((candidate) => candidate.name === name);
  if (!node || !isDocument(node)) throw new Error(`no document named ${name}`);
  return node.id;
}

const NOTES = nodeIdByName("Payment Integration Notes");
const LOCKED = nodeIdByName("Component Review");

beforeEach(() => {
  documentService.reset();
  resetSimulation();
  setSimulation({ latency: "fast" });
});

describe("get", () => {
  test("returns the seeded content for a page", async () => {
    const document = await documentService.get(NOTES);

    expect(document.title).toBe("Payment Integration Notes");
    expect(document.blocks.length).toBeGreaterThan(10);
    expect(document.version).toBe(1);
  });

  test("reports a missing page as not found", async () => {
    await expect(documentService.get("nope")).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "not_found",
    );
  });

  test("a locked page reports who locked it", async () => {
    const document = await documentService.get(LOCKED);

    expect(document.isLocked).toBe(true);
    expect(document.lockedBy).not.toBeNull();
  });
});

describe("save", () => {
  const draft = (blocks: readonly Block[], title = "Payment Integration Notes") => ({
    title,
    icon: "💳",
    blocks,
  });

  test("persists blocks and bumps the version", async () => {
    const before = await documentService.get(NOTES);
    const blocks: readonly Block[] = [{ id: "b1", type: "paragraph", text: "Rewritten" }];

    const saved = await documentService.save(NOTES, draft(blocks));

    expect(saved.blocks).toHaveLength(1);
    expect(saved.version).toBe(before.version + 1);
    expect(await documentService.get(NOTES)).toMatchObject({ version: saved.version });
  });

  test("an empty title falls back to Untitled", async () => {
    const saved = await documentService.save(NOTES, draft([], "   "));
    expect(saved.title).toBe("Untitled");
  });

  test("refuses to write to a locked page", async () => {
    await expect(
      documentService.save(LOCKED, { title: "Component Review", icon: "🧩", blocks: [] }),
    ).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "conflict",
    );
  });

  test("surfaces a retryable failure when the simulation asks for one", async () => {
    setSimulation({ failSaves: true });

    await expect(documentService.save(NOTES, draft([]))).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.isRetryable,
    );
  });

  test("a title containing the failure marker fails deterministically", async () => {
    await expect(documentService.save(NOTES, draft([], "this will fail"))).rejects.toThrow();
  });
});

describe("page actions", () => {
  test("pin and unpin round-trip", async () => {
    expect((await documentService.setPinned(NOTES, true)).isPinned).toBe(true);
    expect((await documentService.setPinned(NOTES, false)).isPinned).toBe(false);
  });

  test("locking records the holder and unlocking clears it", async () => {
    const locked = await documentService.setLocked(NOTES, true, CURRENT_USER);
    expect(locked.lockedBy?.id).toBe(CURRENT_USER.id);

    const unlocked = await documentService.setLocked(NOTES, false, null);
    expect(unlocked.isLocked).toBe(false);
    expect(unlocked.lockedBy).toBeNull();
  });

  test("archive and restore flip the flag", async () => {
    expect((await documentService.setArchived(NOTES, true)).isArchived).toBe(true);
    expect((await documentService.setArchived(NOTES, false)).isArchived).toBe(false);
  });

  test("duplicate copies content onto a new node with fresh block ids", async () => {
    const source = await documentService.get(NOTES);
    const copy = await documentService.duplicate(NOTES, "node_copy", "Payment Integration Notes (copy)");

    expect(copy.nodeId).toBe("node_copy");
    expect(copy.title).toContain("(copy)");
    expect(copy.blocks).toHaveLength(source.blocks.length);
    expect(copy.blocks[0]?.id).not.toBe(source.blocks[0]?.id);
    expect(copy.version).toBe(1);
    expect(copy.isPinned).toBe(false);
    expect(copy.isLocked).toBe(false);
  });

  test("a duplicate is retrievable on its own", async () => {
    await documentService.duplicate(NOTES, "node_copy", "Copy");
    expect((await documentService.get("node_copy")).title).toBe("Copy");
  });

  test("create then remove leaves nothing behind", async () => {
    await documentService.create({
      nodeId: "node_new",
      workspaceId: "ws_nexdrop",
      title: "Fresh page",
      icon: "📄",
      owner: memberAt(1),
      blocks: [{ id: "b", type: "paragraph", text: "" }],
    });

    expect((await documentService.get("node_new")).title).toBe("Fresh page");

    await documentService.remove("node_new");
    await expect(documentService.get("node_new")).rejects.toThrow();
  });

  test("summarize derives the tree-facing patch from the content", async () => {
    const document = await documentService.get(NOTES);
    const summary = documentService.summarize(document);

    expect(summary.name).toBe(document.title);
    expect(summary.blockCount).toBe(document.blocks.length);
    expect(summary.excerpt.length).toBeGreaterThan(0);
  });

  test("reset restores the seeded catalog", async () => {
    await documentService.save(NOTES, { title: "Changed", icon: "💳", blocks: [] });
    documentService.reset();

    expect((await documentService.get(NOTES)).title).toBe("Payment Integration Notes");
  });
});
