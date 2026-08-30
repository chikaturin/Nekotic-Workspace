import { beforeEach, describe, expect, test } from "vitest";
import { VERSION_HISTORY_LIMIT } from "@/config/app";
import { documentLines } from "@/lib/blocks";
import { describeDiff, diffLines, summarizeDiff } from "@/lib/diff";
import {
  compareToCurrent,
  configVersionEntry,
  secretRotationEntries,
} from "@/lib/versions";
import { devtoolsService } from "@/services/devtools-service";
import { documentService } from "@/services/document-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { DEFAULT_WORKSPACE_ID, WORKSPACES } from "@/mock/workspaces";
import { flattenTree } from "@/lib/tree";
import { isDocument, type Block, type DocumentNode } from "@/types";

/**
 * SY-VER-39 — version history for pages, config files and secrets.
 *
 * Restoring writes a new version rather than rewinding, and a secret document
 * deliberately has nothing to restore *from* — both are asserted here.
 */

function documentNodes(): readonly DocumentNode[] {
  return flattenTree(TREES_BY_WORKSPACE[DEFAULT_WORKSPACE_ID] ?? []).filter(
    (node): node is DocumentNode => isDocument(node) && (node.documentKind ?? "page") === "page",
  );
}

function configNode(): DocumentNode {
  const node = flattenTree(TREES_BY_WORKSPACE[DEFAULT_WORKSPACE_ID] ?? []).find(
    (candidate): candidate is DocumentNode =>
      isDocument(candidate) && candidate.documentKind === "config",
  );
  if (!node) throw new Error("no config document in the dataset");
  return node;
}

function secretNode(): DocumentNode {
  const node = flattenTree(TREES_BY_WORKSPACE[DEFAULT_WORKSPACE_ID] ?? []).find(
    (candidate): candidate is DocumentNode =>
      isDocument(candidate) && candidate.documentKind === "secret",
  );
  if (!node) throw new Error("no secret document in the dataset");
  return node;
}

const paragraph = (id: string, text: string): Block => ({ id, type: "paragraph", text });

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  // `workspaces` là BẮT BUỘC: cây chỉ hiện bên trong một workspace người dùng
  // là thành viên. Trước đây store mặc định mang sẵn danh sách từ dữ liệu mẫu,
  // nên test này chạy được nhờ một mặc định chứ không nhờ điều nó khai.
  useWorkspaceStore.setState({
    workspaces: WORKSPACES,
    activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    treeByWorkspace: TREES_BY_WORKSPACE,
    feedback: null,
  });
});

describe("line diff", () => {
  test("an edit in the middle reports one added and one removed line", () => {
    const lines = diffLines(["a", "b", "c"], ["a", "B", "c"]);

    expect(lines.map((line) => line.kind)).toEqual(["same", "removed", "added", "same"]);
    expect(summarizeDiff(lines)).toEqual({ added: 1, removed: 1 });
  });

  test("appending leaves everything before it untouched", () => {
    const lines = diffLines(["a", "b"], ["a", "b", "c"]);

    expect(lines.filter((line) => line.kind === "same")).toHaveLength(2);
    expect(lines.at(-1)).toEqual({ kind: "added", text: "c" });
  });

  test("identical snapshots produce no changes at all", () => {
    const lines = diffLines(["a", "b"], ["a", "b"]);

    expect(lines.every((line) => line.kind === "same")).toBe(true);
    expect(describeDiff(summarizeDiff(lines))).toBe("no line changes");
  });

  test("deleting everything reads as removal, not as a rewrite", () => {
    expect(summarizeDiff(diffLines(["a", "b", "c"], []))).toEqual({ added: 0, removed: 3 });
    expect(describeDiff({ added: 3, removed: 1 })).toBe("+3 −1 lines");
  });
});

describe("a page as lines", () => {
  test("structure is part of the text, so a promotion shows up", () => {
    const before = documentLines([paragraph("b1", "Overview")]);
    const after = documentLines([{ id: "b1", type: "heading2", text: "Overview" }]);

    expect(before).toEqual(["Overview"]);
    expect(after).toEqual(["## Overview"]);
    expect(summarizeDiff(diffLines(before, after))).toEqual({ added: 1, removed: 1 });
  });

  test("every block kind renders to something readable", () => {
    const lines = documentLines([
      { id: "1", type: "checklist", text: "Ship it", isChecked: true },
      { id: "2", type: "code", code: "const a = 1;", language: "typescript" },
      { id: "3", type: "table", hasHeaderRow: true, rows: [["a", "b"]] },
      { id: "4", type: "link", url: "https://x.dev", title: "X", description: "", siteName: "" },
    ]);

    expect(lines).toContain("[x] Ship it");
    expect(lines).toContain("const a = 1;");
    expect(lines).toContain("| a | b |");
    expect(lines).toContain("[link] X");
  });
});

describe("page history", () => {
  test("a save records a version with what it changed", async () => {
    const node = documentNodes()[0]!;
    const original = await documentService.get(node.id);

    await documentService.save(node.id, {
      title: original.title,
      icon: original.icon,
      blocks: [...original.blocks, paragraph("new_1", "One more paragraph")],
    });

    const versions = await documentService.listVersions(node.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.version).toBe(2);
    expect(versions[0]?.summary).toBe("+1 lines");
  });

  test("restoring writes a new version instead of rewinding", async () => {
    const node = documentNodes()[0]!;
    const original = await documentService.get(node.id);

    await documentService.save(node.id, {
      title: original.title,
      icon: original.icon,
      blocks: [paragraph("only", "Replaced everything")],
    });

    const versions = await documentService.listVersions(node.id);
    const first = versions.at(-1)!;

    const restored = await documentService.restoreVersion(node.id, first.id);

    expect(restored.version).toBe(3);
    expect(documentLines(restored.blocks)).toEqual(documentLines(original.blocks));

    const after = await documentService.listVersions(node.id);
    expect(after).toHaveLength(3);
    // Nothing was rewritten: the version that was replaced is still on record.
    expect(after.some((version) => version.version === 2)).toBe(true);
  });

  test("history is bounded so a long-lived page cannot grow without limit", async () => {
    const node = documentNodes()[0]!;
    const original = await documentService.get(node.id);

    for (let index = 0; index < VERSION_HISTORY_LIMIT + 5; index += 1) {
      await documentService.save(node.id, {
        title: original.title,
        icon: original.icon,
        blocks: [paragraph("only", `Revision ${index}`)],
      });
    }

    expect(await documentService.listVersions(node.id)).toHaveLength(VERSION_HISTORY_LIMIT);
  });

  test("a locked page refuses a restore for the same reason it refuses an edit", async () => {
    const node = documentNodes()[0]!;
    const original = await documentService.get(node.id);

    await documentService.save(node.id, {
      title: original.title,
      icon: original.icon,
      blocks: [paragraph("only", "Something else")],
    });

    const versions = await documentService.listVersions(node.id);
    await documentService.setLocked(node.id, true);

    await expect(documentService.restoreVersion(node.id, versions.at(-1)!.id)).rejects.toThrow(
      /locked/i,
    );
  });
});

describe("projecting three subjects onto one history", () => {
  test("a page version carries its blocks as lines", async () => {
    const node = documentNodes()[0]!;
    // API trả thẳng `VersionEntry`; không còn bước map từ bản đầy đủ, vì lịch
    // sử không mang `blocks` qua wire nữa.
    const [entry] = await documentService.listVersions(node.id);

    expect(entry?.hasSnapshot).toBe(true);
    expect(entry!.lines.length).toBeGreaterThan(0);
    expect(entry!.version).toBe(1);
  });

  test("a config version carries its file, and compares against the draft", async () => {
    const node = configNode();
    const document = await devtoolsService.getConfig(node.id);
    const [version] = await devtoolsService.listConfigVersions(node.id);
    const entry = configVersionEntry(version!);

    expect(entry.hasSnapshot).toBe(true);
    expect(entry.lines).toEqual(document.content.split("\n"));

    const drafted = [...entry.lines, "# an unsaved line"];
    expect(summarizeDiff(compareToCurrent(entry, drafted))).toEqual({ added: 1, removed: 0 });
  });

  test("a secret's history records rotations and never a value", async () => {
    const node = secretNode();
    const document = await devtoolsService.getSecrets(node.id);
    const entries = secretRotationEntries(document);

    expect(entries.length).toBe(document.entries.length);
    for (const entry of entries) {
      expect(entry.hasSnapshot).toBe(false);
      expect(entry.lines).toHaveLength(0);
      expect(entry.summary).toMatch(/^rotated /);
    }

    // Nothing in the projection resembles a secret value, masked or otherwise.
    expect(JSON.stringify(entries)).not.toContain("•");
  });

  test("rotations read newest first", async () => {
    const node = secretNode();
    const entries = secretRotationEntries(await devtoolsService.getSecrets(node.id));
    const times = entries.map((entry) => Date.parse(entry.createdAt));

    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});
