import { describe, expect, test } from "vitest";
import {
  extensionOf,
  isPreviewable,
  kindFromFileName,
  nodeVisual,
} from "@/lib/node-visuals";
import { findNodeById } from "@/lib/tree";
import { buildTestTree, ID } from "./helpers";

const tree = buildTestTree();
const node = (id: string) => findNodeById(tree, id)!;

describe("kindFromFileName", () => {
  test.each([
    ["hero.png", "image"],
    ["spec.PDF", "pdf"],
    ["budget.xlsx", "spreadsheet"],
    ["service.ts", "code"],
    ["clip.mp4", "video"],
    ["track.mp3", "audio"],
    ["bundle.zip", "archive"],
    ["notes.md", "document"],
    ["archive.unknown", "other"],
    ["no-extension", "other"],
  ])("classifies %s as %s", (name, expected) => {
    expect(kindFromFileName(name)).toBe(expected);
  });

  test("extensionOf returns an empty string when there is no extension", () => {
    expect(extensionOf("README")).toBe("");
    expect(extensionOf("a.Tar.GZ")).toBe("gz");
  });
});

describe("nodeVisual", () => {
  test("projects use the accent colour", () => {
    expect(nodeVisual(node(ID.development)).colorClass).toBe("text-accent");
  });

  test("folders swap glyph when open", () => {
    const closed = nodeVisual(node(ID.payment), false);
    const open = nodeVisual(node(ID.payment), true);

    expect(closed.label).toBe("Folder");
    expect(open.Icon).not.toBe(closed.Icon);
  });

  test("boards report their board kind", () => {
    expect(nodeVisual(node(ID.roadmap)).label).toBe("Timeline");
  });

  test("files map kind to a colour token class", () => {
    const visual = nodeVisual(node(ID.spec));

    expect(visual.label).toBe("PDF");
    expect(visual.colorClass).toBe("text-kind-pdf");
    expect(visual.tintClass).toBe("bg-kind-pdf/10");
  });
});

describe("isPreviewable", () => {
  test("images, documents, code and PDFs preview inline", () => {
    expect(isPreviewable(node(ID.spec))).toBe(true);
  });

  test("containers never preview inline", () => {
    expect(isPreviewable(node(ID.payment))).toBe(false);
    expect(isPreviewable(node(ID.roadmap))).toBe(false);
  });
});
