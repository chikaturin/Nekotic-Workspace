import type {
  Block,
  BlockType,
  CodeLanguage,
  TextualBlock,
} from "@/types";

const TEXTUAL_TYPES = new Set<BlockType>([
  "heading1",
  "heading2",
  "heading3",
  "paragraph",
  "quote",
  "checklist",
  "bulletList",
  "numberedList",
]);

export const isTextualBlock = (block: Block): block is TextualBlock =>
  TEXTUAL_TYPES.has(block.type);

export const DEFAULT_TABLE_COLUMNS = 3;
export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_CODE_LANGUAGE: CodeLanguage = "typescript";

interface CreateBlockInit {
  readonly text?: string;
  readonly language?: CodeLanguage;
  readonly url?: string;
}

export function createBlock(type: BlockType, id: string, init: CreateBlockInit = {}): Block {
  const text = init.text ?? "";

  switch (type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "paragraph":
    case "quote":
      return { id, type, text };
    case "checklist":
      return { id, type, text, isChecked: false };
    case "bulletList":
    case "numberedList":
      return { id, type, text };
    case "code":
      return { id, type, code: text, language: init.language ?? DEFAULT_CODE_LANGUAGE };
    case "image":
      return {
        id,
        type,
        images: init.url ? [{ assetId: null, url: init.url, alt: "" }] : [],
        caption: "",
      };
    case "attachment":
      return { id, type, assetId: null, name: "", sizeBytes: 0, mimeType: "" };
    case "link":
      return { id, type, url: init.url ?? "", title: "", description: "", siteName: "" };
    case "table":
      return { id, type, hasHeaderRow: true, rows: emptyTableRows() };
    case "embed":
      return { id, type, boardNodeId: null, viewId: null };
  }
}

function emptyTableRows(): readonly (readonly string[])[] {
  return Array.from({ length: DEFAULT_TABLE_ROWS }, () =>
    Array.from({ length: DEFAULT_TABLE_COLUMNS }, () => ""),
  );
}

export function emptyDocumentBlocks(idFactory: () => string): readonly Block[] {
  return [createBlock("paragraph", idFactory())];
}

export function indexOfBlock(blocks: readonly Block[], blockId: string): number {
  return blocks.findIndex((block) => block.id === blockId);
}

export function findBlock(blocks: readonly Block[], blockId: string): Block | null {
  return blocks.find((block) => block.id === blockId) ?? null;
}

export function blockText(block: Block): string | null {
  if (isTextualBlock(block)) return block.text;
  if (block.type === "code") return block.code;
  return null;
}

export function withText(block: Block, text: string): Block {
  if (isTextualBlock(block)) return { ...block, text };
  if (block.type === "code") return { ...block, code: text };
  return block;
}

export function updateBlock(
  blocks: readonly Block[],
  blockId: string,
  updater: (block: Block) => Block,
): readonly Block[] {
  const next = blocks.map((block) => (block.id === blockId ? updater(block) : block));
  return next.some((block, index) => block !== blocks[index]) ? next : blocks;
}

export function insertBlockAt(
  blocks: readonly Block[],
  index: number,
  block: Block,
): readonly Block[] {
  const position = Math.max(0, Math.min(index, blocks.length));
  return [...blocks.slice(0, position), block, ...blocks.slice(position)];
}

export function insertBlockAfter(
  blocks: readonly Block[],
  afterId: string,
  block: Block,
): readonly Block[] {
  const index = indexOfBlock(blocks, afterId);
  return index < 0 ? [...blocks, block] : insertBlockAt(blocks, index + 1, block);
}

export function removeBlock(
  blocks: readonly Block[],
  blockId: string,
  idFactory: () => string,
): readonly Block[] {
  const next = blocks.filter((block) => block.id !== blockId);
  if (next.length === blocks.length) return blocks;
  return next.length > 0 ? next : emptyDocumentBlocks(idFactory);
}

export function duplicateBlock(
  blocks: readonly Block[],
  blockId: string,
  idFactory: () => string,
): readonly Block[] {
  const block = findBlock(blocks, blockId);
  if (!block) return blocks;
  return insertBlockAfter(blocks, blockId, { ...block, id: idFactory() });
}

export function moveBlock(
  blocks: readonly Block[],
  blockId: string,
  toIndex: number,
): readonly Block[] {
  const from = indexOfBlock(blocks, blockId);
  if (from < 0) return blocks;

  const target = Math.max(0, Math.min(toIndex, blocks.length - 1));
  if (target === from) return blocks;

  const without = blocks.filter((_, index) => index !== from);
  const block = blocks[from];
  if (!block) return blocks;

  return [...without.slice(0, target), block, ...without.slice(target)];
}

export function moveBlockToInsertionIndex(
  blocks: readonly Block[],
  blockId: string,
  insertionIndex: number,
): readonly Block[] {
  const from = indexOfBlock(blocks, blockId);
  if (from < 0) return blocks;

  return moveBlock(blocks, blockId, from < insertionIndex ? insertionIndex - 1 : insertionIndex);
}

export function moveBlockBy(
  blocks: readonly Block[],
  blockId: string,
  delta: number,
): readonly Block[] {
  const from = indexOfBlock(blocks, blockId);
  if (from < 0) return blocks;
  return moveBlock(blocks, blockId, from + delta);
}

export function convertBlock(block: Block, type: BlockType, idFactory: () => string): Block {
  if (block.type === type) return block;

  const carriedText = blockText(block) ?? "";
  const converted = createBlock(type, block.id, { text: carriedText });

  if (type === "checklist" && block.type === "checklist") {
    return { ...converted, isChecked: block.isChecked } as Block;
  }
  if (
    type === "image" ||
    type === "attachment" ||
    type === "link" ||
    type === "table" ||
    type === "embed"
  ) {
    return createBlock(type, block.id === "" ? idFactory() : block.id);
  }
  return converted;
}

export interface SplitResult {
  readonly blocks: readonly Block[];
  readonly focusBlockId: string;
}

export function splitBlock(
  blocks: readonly Block[],
  blockId: string,
  caretOffset: number,
  idFactory: () => string,
): SplitResult {
  const block = findBlock(blocks, blockId);
  if (!block || !isTextualBlock(block)) {
    const appended = createBlock("paragraph", idFactory());
    return { blocks: insertBlockAfter(blocks, blockId, appended), focusBlockId: appended.id };
  }

  const offset = Math.max(0, Math.min(caretOffset, block.text.length));
  const head = block.text.slice(0, offset);
  const tail = block.text.slice(offset);

  const continuationType: BlockType =
    block.type === "checklist" || block.type === "bulletList" || block.type === "numberedList"
      ? block.type
      : "paragraph";

  const next = createBlock(continuationType, idFactory(), { text: tail });
  const updated = updateBlock(blocks, blockId, (current) => withText(current, head));

  return { blocks: insertBlockAfter(updated, blockId, next), focusBlockId: next.id };
}

export interface MergeResult {
  readonly blocks: readonly Block[];
  readonly focusBlockId: string | null;
  readonly caretOffset: number;
}

export function mergeWithPrevious(
  blocks: readonly Block[],
  blockId: string,
  idFactory: () => string,
): MergeResult {
  const index = indexOfBlock(blocks, blockId);
  const block = index >= 0 ? blocks[index] : null;
  if (!block) return { blocks, focusBlockId: null, caretOffset: 0 };

  if (isTextualBlock(block) && block.type !== "paragraph") {
    return {
      blocks: updateBlock(blocks, blockId, (current) =>
        convertBlock(current, "paragraph", idFactory),
      ),
      focusBlockId: blockId,
      caretOffset: 0,
    };
  }

  const previous = index > 0 ? blocks[index - 1] : null;
  if (!previous) return { blocks, focusBlockId: blockId, caretOffset: 0 };

  const currentText = blockText(block) ?? "";

  if (!isTextualBlock(previous)) {
    if (currentText.length === 0) {
      return {
        blocks: removeBlock(blocks, blockId, idFactory),
        focusBlockId: previous.id,
        caretOffset: 0,
      };
    }
    return { blocks, focusBlockId: blockId, caretOffset: 0 };
  }

  const caretOffset = previous.text.length;
  const merged = updateBlock(blocks, previous.id, (current) =>
    withText(current, previous.text + currentText),
  );

  return {
    blocks: merged.filter((candidate) => candidate.id !== blockId),
    focusBlockId: previous.id,
    caretOffset,
  };
}

export function documentPlainText(blocks: readonly Block[]): string {
  return blocks
    .map((block) => {
      if (isTextualBlock(block)) return block.text;
      switch (block.type) {
        case "code":
          return block.code;
        case "image":
          return block.caption || block.images.map((image) => image.alt).join(" ");
        case "attachment":
          return block.name;
        case "link":
          return [block.title, block.url].filter(Boolean).join(" ");
        case "table":
          return block.rows.map((row) => row.join(" ")).join(" ");
        case "embed":
          return "";
      }
    })
    .filter((text) => text.length > 0)
    .join("\n");
}

const LINE_PREFIX: Partial<Record<BlockType, string>> = {
  heading1: "# ",
  heading2: "## ",
  heading3: "### ",
  quote: "> ",
  bulletList: "• ",
  numberedList: "1. ",
};

export function documentLines(blocks: readonly Block[]): readonly string[] {
  return blocks.flatMap((block): readonly string[] => {
    if (block.type === "checklist") return [`[${block.isChecked ? "x" : " "}] ${block.text}`];
    if (isTextualBlock(block)) return [`${LINE_PREFIX[block.type] ?? ""}${block.text}`];

    switch (block.type) {
      case "code":
        return [`\`\`\`${block.language}`, ...block.code.split("\n"), "\`\`\`"];
      case "image": {
        const label = block.caption || block.images.map((image) => image.alt).join(", ");
        return [`[image] ${label}`.trimEnd()];
      }
      case "attachment":
        return [`[file] ${block.name}`];
      case "link":
        return [`[link] ${block.title || block.url}`];
      case "table":
        return block.rows.map((row) => `| ${row.join(" | ")} |`);
      case "embed":
        return [`[board] ${block.boardNodeId ?? "none selected"}`];
    }
  });
}

export function documentExcerpt(blocks: readonly Block[], maxLength = 140): string {
  const text = documentPlainText(blocks).replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function countWords(blocks: readonly Block[]): number {
  const text = documentPlainText(blocks).trim();
  return text.length === 0 ? 0 : text.split(/\s+/).length;
}

export function isDocumentEmpty(blocks: readonly Block[]): boolean {
  return documentPlainText(blocks).trim().length === 0;
}
