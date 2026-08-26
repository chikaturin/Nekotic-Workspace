import { describe, expect, test } from "vitest";
import { previewStrategyFor } from "@/lib/preview-strategy";
import { formatClockTime } from "@/lib/format";
import { visibleFilesOf } from "@/lib/tree";
import { findNodeById } from "@/lib/tree";
import { buildTestTree, ID } from "./helpers";

describe("previewStrategyFor", () => {
  test.each([
    ["png", "image", "image"],
    ["jpg", "image", "image"],
    ["svg", "image", "image"],
    ["pdf", "pdf", "pdf"],
    ["txt", "document", "text"],
    ["md", "document", "text"],
    ["csv", "spreadsheet", "sheet"],
    ["tsv", "spreadsheet", "sheet"],
    ["xlsx", "spreadsheet", "sheet"],
    ["ts", "code", "text"],
    ["sh", "other", "text"],
    ["yml", "other", "text"],
    ["sql", "code", "text"],
  ] as const)("%s previews as %s", (extension, kind, expected) => {
    expect(previewStrategyFor({ kind, extension })).toBe(expected);
  });

  test("binary containers are never treated as text", () => {
    // xlsx is a zip: rendering its bytes as text produced mojibake before. It
    // opens in the grid now, but must never fall back to the text surface.
    expect(previewStrategyFor({ kind: "spreadsheet", extension: "xlsx" })).not.toBe("text");
    expect(previewStrategyFor({ kind: "archive", extension: "zip" })).toBe("none");
    expect(previewStrategyFor({ kind: "video", extension: "mp4" })).toBe("none");
    expect(previewStrategyFor({ kind: "other", extension: "docx" })).toBe("none");
  });

  test("mime types fill in when the extension is missing", () => {
    expect(previewStrategyFor({ kind: "other", extension: "", mimeType: "application/pdf" })).toBe("pdf");
    expect(previewStrategyFor({ kind: "other", extension: "", mimeType: "text/plain" })).toBe("text");
    expect(previewStrategyFor({ kind: "other", extension: "" })).toBe("none");
  });

  test("a known extension outranks a contradictory mime type", () => {
    expect(previewStrategyFor({ kind: "video", extension: "mp4", mimeType: "application/pdf" })).toBe(
      "none",
    );
    expect(previewStrategyFor({ kind: "other", extension: "png", mimeType: "text/plain" })).toBe(
      "image",
    );
  });

  test("the decision is case-insensitive", () => {
    expect(previewStrategyFor({ kind: "other", extension: "PDF" })).toBe("pdf");
    expect(previewStrategyFor({ kind: "other", extension: "TXT" })).toBe("text");
  });
});

describe("formatClockTime", () => {
  test("renders a stable 24-hour label", () => {
    expect(formatClockTime("2026-08-26T09:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  test("bad input degrades to a dash", () => {
    expect(formatClockTime("nope")).toBe("—");
  });
});

describe("visibleFilesOf", () => {
  const tree = buildTestTree();

  test("returns the files directly inside a folder", () => {
    const folder = findNodeById(tree, ID.payment);
    expect(visibleFilesOf(tree, folder).map((node) => node.name).sort()).toEqual([
      "flow.png",
      "spec.pdf",
    ]);
  });

  test("skips trashed files and containers", () => {
    expect(visibleFilesOf(tree, null).map((node) => node.name)).toEqual([]);
  });
});
