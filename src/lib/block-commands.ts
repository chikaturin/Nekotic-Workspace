import type { BlockType } from "@/types";

export type BlockCommandGroup = "text" | "list" | "media" | "advanced";

export interface BlockCommand {
  readonly type: BlockType;
  readonly label: string;
  readonly description: string;
  readonly group: BlockCommandGroup;
  readonly keywords: readonly string[];
  readonly markdownPrefix?: string;
}

export const BLOCK_COMMANDS: readonly BlockCommand[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Plain paragraph",
    group: "text",
    keywords: ["text", "paragraph", "body", "p"],
  },
  {
    type: "heading1",
    label: "Heading 1",
    description: "Large section title",
    group: "text",
    keywords: ["h1", "title", "heading"],
    markdownPrefix: "#",
  },
  {
    type: "heading2",
    label: "Heading 2",
    description: "Medium section title",
    group: "text",
    keywords: ["h2", "subtitle", "heading"],
    markdownPrefix: "##",
  },
  {
    type: "heading3",
    label: "Heading 3",
    description: "Small section title",
    group: "text",
    keywords: ["h3", "heading"],
    markdownPrefix: "###",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Callout or citation",
    group: "text",
    keywords: ["quote", "blockquote", "citation"],
    markdownPrefix: ">",
  },
  {
    type: "checklist",
    label: "Checklist",
    description: "Task with a checkbox",
    group: "list",
    keywords: ["todo", "task", "check", "checkbox"],
    markdownPrefix: "[]",
  },
  {
    type: "bulletList",
    label: "Bulleted list",
    description: "Unordered list item",
    group: "list",
    keywords: ["bullet", "unordered", "list", "ul"],
    markdownPrefix: "-",
  },
  {
    type: "numberedList",
    label: "Numbered list",
    description: "Ordered list item",
    group: "list",
    keywords: ["number", "ordered", "list", "ol"],
    markdownPrefix: "1.",
  },
  {
    type: "code",
    label: "Code block",
    description: "Monospaced snippet with a language",
    group: "advanced",
    keywords: ["code", "snippet", "pre", "monospace"],
    markdownPrefix: "```",
  },
  {
    type: "image",
    label: "Image",
    description: "Add one or more images",
    group: "media",
    keywords: ["image", "picture", "photo", "png", "jpg"],
  },
  {
    type: "attachment",
    label: "Attachment",
    description: "Attach any file to the page",
    group: "media",
    keywords: ["file", "attachment", "upload", "pdf"],
  },
  {
    type: "link",
    label: "Link",
    description: "Bookmark card for a URL",
    group: "media",
    keywords: ["link", "url", "bookmark", "embed"],
  },
  {
    type: "table",
    label: "Table",
    description: "Simple grid of cells",
    group: "advanced",
    keywords: ["table", "grid", "rows", "columns"],
  },
  {
    type: "embed",
    label: "Board view",
    description: "Embed a saved view of a board",
    group: "advanced",
    keywords: ["board", "embed", "view", "table", "database"],
  },
] as const;

export const GROUP_LABELS: Readonly<Record<BlockCommandGroup, string>> = {
  text: "Text",
  list: "Lists",
  media: "Media",
  advanced: "Advanced",
};

export function matchBlockCommands(query: string): readonly BlockCommand[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return BLOCK_COMMANDS;

  const scored = BLOCK_COMMANDS.map((command) => ({ command, score: scoreCommand(command, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label));

  return scored.map((entry) => entry.command);
}

function scoreCommand(command: BlockCommand, needle: string): number {
  const label = command.label.toLowerCase();
  if (label.startsWith(needle)) return 3;
  if (label.includes(needle)) return 2;
  if (command.keywords.some((keyword) => keyword.startsWith(needle))) return 1;
  return 0;
}

export function findBlockCommand(type: BlockType): BlockCommand | null {
  return BLOCK_COMMANDS.find((command) => command.type === type) ?? null;
}

export function blockTypeForMarkdown(prefix: string): BlockType | null {
  return BLOCK_COMMANDS.find((command) => command.markdownPrefix === prefix)?.type ?? null;
}

export interface MarkdownShortcut {
  readonly type: BlockType;
  readonly rest: string;
}

export function detectMarkdownShortcut(text: string): MarkdownShortcut | null {
  const match = /^(\S{1,3})\s/.exec(text);
  if (!match) return null;

  const prefix = match[1] ?? "";
  const type = blockTypeForMarkdown(prefix);
  if (!type) return null;

  return { type, rest: text.slice(match[0].length) };
}
