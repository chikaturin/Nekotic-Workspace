import { describe, expect, test } from "vitest";
import {
  convertBlock,
  countWords,
  createBlock,
  documentExcerpt,
  documentPlainText,
  duplicateBlock,
  emptyDocumentBlocks,
  findBlock,
  indexOfBlock,
  insertBlockAfter,
  insertBlockAt,
  isDocumentEmpty,
  isTextualBlock,
  mergeWithPrevious,
  moveBlock,
  moveBlockBy,
  moveBlockToInsertionIndex,
  removeBlock,
  splitBlock,
  updateBlock,
  withText,
} from "@/lib/blocks";
import type { Block } from "@/types";

let sequence = 0;
const nextId = () => `new_${(sequence += 1)}`;

function resetIds() {
  sequence = 0;
}

function sampleBlocks(): readonly Block[] {
  return [
    { id: "b1", type: "heading1", text: "Title" },
    { id: "b2", type: "paragraph", text: "Hello world" },
    { id: "b3", type: "checklist", text: "Ship it", isChecked: false },
    { id: "b4", type: "code", language: "typescript", code: "const a = 1;" },
  ];
}

describe("createBlock", () => {
  test.each(["paragraph", "heading2", "quote"] as const)("%s starts with empty text", (type) => {
    const block = createBlock(type, "id");
    expect(isTextualBlock(block) && block.text).toBe("");
  });

  test("checklist starts unchecked", () => {
    const block = createBlock("checklist", "id");
    expect(block.type === "checklist" && block.isChecked).toBe(false);
  });

  test("code carries the default language", () => {
    const block = createBlock("code", "id");
    expect(block.type === "code" && block.language).toBe("typescript");
  });

  test("table starts as a rectangular grid with a header row", () => {
    const block = createBlock("table", "id");
    if (block.type !== "table") throw new Error("expected a table");

    expect(block.rows).toHaveLength(3);
    expect(block.rows.every((row) => row.length === 3)).toBe(true);
    expect(block.hasHeaderRow).toBe(true);
  });

  test("media blocks start unattached", () => {
    const image = createBlock("image", "id");
    const attachment = createBlock("attachment", "id");

    expect(image.type === "image" && image.images).toEqual([]);
    expect(attachment.type === "attachment" && attachment.name).toBe("");
  });

  test("a new document holds exactly one paragraph", () => {
    resetIds();
    const blocks = emptyDocumentBlocks(nextId);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("paragraph");
  });
});

describe("access helpers", () => {
  test("finds blocks and their positions", () => {
    const blocks = sampleBlocks();

    expect(findBlock(blocks, "b3")?.type).toBe("checklist");
    expect(indexOfBlock(blocks, "b3")).toBe(2);
    expect(findBlock(blocks, "missing")).toBeNull();
    expect(indexOfBlock(blocks, "missing")).toBe(-1);
  });

  test("withText writes textual and code blocks, leaves others alone", () => {
    const table = createBlock("table", "t");

    expect(isTextualBlock(withText({ id: "p", type: "paragraph", text: "" }, "hi"))).toBe(true);
    expect(withText(table, "hi")).toBe(table);
  });
});

describe("structural edits", () => {
  test("updateBlock keeps identity when nothing changes", () => {
    const blocks = sampleBlocks();
    expect(updateBlock(blocks, "missing", (block) => block)).toBe(blocks);
  });

  test("insertBlockAfter places the block behind its sibling", () => {
    resetIds();
    const blocks = insertBlockAfter(sampleBlocks(), "b2", createBlock("quote", nextId()));

    expect(blocks.map((block) => block.type)).toEqual([
      "heading1",
      "paragraph",
      "quote",
      "checklist",
      "code",
    ]);
  });

  test("insertBlockAfter appends when the anchor is unknown", () => {
    resetIds();
    const blocks = insertBlockAfter(sampleBlocks(), "nope", createBlock("quote", nextId()));
    expect(blocks[blocks.length - 1]?.type).toBe("quote");
  });

  test("insertBlockAt clamps out-of-range positions", () => {
    resetIds();
    const blocks = insertBlockAt(sampleBlocks(), 99, createBlock("quote", nextId()));
    expect(blocks).toHaveLength(5);
  });

  test("removing the last block leaves a fresh paragraph", () => {
    resetIds();
    const single: readonly Block[] = [{ id: "only", type: "heading1", text: "Solo" }];

    const blocks = removeBlock(single, "only", nextId);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("paragraph");
    expect(blocks[0]?.id).not.toBe("only");
  });

  test("removing an unknown block is a no-op", () => {
    const blocks = sampleBlocks();
    expect(removeBlock(blocks, "missing", nextId)).toBe(blocks);
  });

  test("duplicate inserts a copy with a new id right after the original", () => {
    resetIds();
    const blocks = duplicateBlock(sampleBlocks(), "b2", nextId);

    expect(blocks).toHaveLength(5);
    expect(blocks[2]?.type).toBe("paragraph");
    expect(blocks[2]?.id).not.toBe("b2");
  });

  test("moveBlock reorders and clamps to the document bounds", () => {
    const blocks = sampleBlocks();

    expect(moveBlock(blocks, "b1", 2).map((block) => block.id)).toEqual(["b2", "b3", "b1", "b4"]);
    expect(moveBlock(blocks, "b1", 99).map((block) => block.id)).toEqual(["b2", "b3", "b4", "b1"]);
    expect(moveBlock(blocks, "b1", 0)).toBe(blocks);
    expect(moveBlock(blocks, "missing", 1)).toBe(blocks);
  });

  test("dropping into a gap accounts for the block leaving its old slot", () => {
    const blocks = sampleBlocks();

    // b1 dragged into the gap after b2 (insertion index 2 in the original order).
    expect(moveBlockToInsertionIndex(blocks, "b1", 2).map((block) => block.id)).toEqual([
      "b2",
      "b1",
      "b3",
      "b4",
    ]);

    // b4 dragged upwards into the gap before b2 needs no adjustment.
    expect(moveBlockToInsertionIndex(blocks, "b4", 1).map((block) => block.id)).toEqual([
      "b1",
      "b4",
      "b2",
      "b3",
    ]);
  });

  test("dropping a block back into its own gap changes nothing", () => {
    const blocks = sampleBlocks();

    expect(moveBlockToInsertionIndex(blocks, "b2", 1)).toBe(blocks);
    expect(moveBlockToInsertionIndex(blocks, "b2", 2)).toBe(blocks);
    expect(moveBlockToInsertionIndex(blocks, "missing", 1)).toBe(blocks);
  });

  test("moveBlockBy walks one step at a time", () => {
    const blocks = sampleBlocks();

    expect(moveBlockBy(blocks, "b3", -1).map((block) => block.id)).toEqual(["b1", "b3", "b2", "b4"]);
    expect(moveBlockBy(blocks, "b1", -1)).toBe(blocks);
  });
});

describe("convertBlock", () => {
  test("carries text between textual types", () => {
    resetIds();
    const converted = convertBlock({ id: "p", type: "paragraph", text: "Roadmap" }, "heading2", nextId);

    expect(converted.type).toBe("heading2");
    expect(isTextualBlock(converted) && converted.text).toBe("Roadmap");
  });

  test("keeps the checked state when a checklist stays a checklist", () => {
    resetIds();
    const block: Block = { id: "c", type: "checklist", text: "Done", isChecked: true };

    expect(convertBlock(block, "checklist", nextId)).toBe(block);
  });

  test("code text survives a conversion to paragraph", () => {
    resetIds();
    const converted = convertBlock(
      { id: "c", type: "code", language: "sql", code: "select 1" },
      "paragraph",
      nextId,
    );

    expect(isTextualBlock(converted) && converted.text).toBe("select 1");
  });

  test("structural targets start empty", () => {
    resetIds();
    const converted = convertBlock({ id: "p", type: "paragraph", text: "text" }, "table", nextId);

    expect(converted.type).toBe("table");
    expect(converted.id).toBe("p");
  });
});

describe("splitBlock", () => {
  test("splits text at the caret and continues as a paragraph", () => {
    resetIds();
    const result = splitBlock(sampleBlocks(), "b2", 5, nextId);

    const [first, second] = [result.blocks[1], result.blocks[2]];
    expect(isTextualBlock(first!) && first!.text).toBe("Hello");
    expect(isTextualBlock(second!) && second!.text).toBe(" world");
    expect(second?.type).toBe("paragraph");
    expect(result.focusBlockId).toBe(second?.id);
  });

  test("list items continue as the same list type", () => {
    resetIds();
    const blocks: readonly Block[] = [{ id: "l", type: "bulletList", text: "one" }];

    const result = splitBlock(blocks, "l", 3, nextId);

    expect(result.blocks[1]?.type).toBe("bulletList");
  });

  test("clamps a caret beyond the text length", () => {
    resetIds();
    const result = splitBlock(sampleBlocks(), "b1", 999, nextId);
    const created = result.blocks[1];

    expect(isTextualBlock(created!) && created!.text).toBe("");
  });

  test("a structural block gets a new paragraph after it", () => {
    resetIds();
    const result = splitBlock(sampleBlocks(), "b4", 0, nextId);

    expect(result.blocks[4]?.type).toBe("paragraph");
    expect(result.focusBlockId).toBe(result.blocks[4]?.id);
  });
});

describe("mergeWithPrevious", () => {
  test("a styled block degrades to a paragraph first", () => {
    resetIds();
    const result = mergeWithPrevious(sampleBlocks(), "b1", nextId);

    expect(result.blocks[0]?.type).toBe("paragraph");
    expect(result.blocks).toHaveLength(4);
    expect(result.focusBlockId).toBe("b1");
  });

  test("a plain paragraph merges into the previous textual block", () => {
    resetIds();
    const blocks: readonly Block[] = [
      { id: "a", type: "paragraph", text: "Hello" },
      { id: "b", type: "paragraph", text: " world" },
    ];

    const result = mergeWithPrevious(blocks, "b", nextId);

    expect(result.blocks).toHaveLength(1);
    expect(isTextualBlock(result.blocks[0]!) && result.blocks[0]!.text).toBe("Hello world");
    expect(result.caretOffset).toBe(5);
  });

  test("the first block of a document cannot merge upwards", () => {
    resetIds();
    const blocks: readonly Block[] = [{ id: "a", type: "paragraph", text: "Hello" }];

    const result = mergeWithPrevious(blocks, "a", nextId);

    expect(result.blocks).toBe(blocks);
    expect(result.focusBlockId).toBe("a");
  });

  test("an empty paragraph after a structural block deletes itself", () => {
    resetIds();
    const blocks: readonly Block[] = [
      { id: "t", type: "table", hasHeaderRow: true, rows: [["a"]] },
      { id: "p", type: "paragraph", text: "" },
    ];

    const result = mergeWithPrevious(blocks, "p", nextId);

    expect(result.blocks).toHaveLength(1);
    expect(result.focusBlockId).toBe("t");
  });

  test("a non-empty paragraph after a structural block is left alone", () => {
    resetIds();
    const blocks: readonly Block[] = [
      { id: "t", type: "table", hasHeaderRow: true, rows: [["a"]] },
      { id: "p", type: "paragraph", text: "text" },
    ];

    expect(mergeWithPrevious(blocks, "p", nextId).blocks).toBe(blocks);
  });
});

describe("derivations", () => {
  test("plain text flattens every block kind", () => {
    const blocks: readonly Block[] = [
      { id: "1", type: "heading1", text: "Title" },
      { id: "2", type: "code", language: "sql", code: "select 1" },
      { id: "3", type: "image", images: [], caption: "Caption" },
      { id: "4", type: "attachment", assetId: null, name: "spec.pdf", sizeBytes: 1, mimeType: "" },
      { id: "5", type: "link", url: "https://a.dev", title: "Link", description: "", siteName: "" },
      { id: "6", type: "table", hasHeaderRow: true, rows: [["x", "y"]] },
    ];

    const text = documentPlainText(blocks);

    expect(text).toContain("Title");
    expect(text).toContain("select 1");
    expect(text).toContain("Caption");
    expect(text).toContain("spec.pdf");
    expect(text).toContain("https://a.dev");
    expect(text).toContain("x y");
  });

  test("excerpt truncates with an ellipsis", () => {
    const blocks: readonly Block[] = [{ id: "1", type: "paragraph", text: "a".repeat(200) }];

    const excerpt = documentExcerpt(blocks, 40);

    expect(excerpt).toHaveLength(40);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  test("word count and emptiness", () => {
    expect(countWords(sampleBlocks())).toBeGreaterThan(3);
    expect(countWords([{ id: "1", type: "paragraph", text: "   " }])).toBe(0);
    expect(isDocumentEmpty([{ id: "1", type: "paragraph", text: "" }])).toBe(true);
    expect(isDocumentEmpty(sampleBlocks())).toBe(false);
  });
});
