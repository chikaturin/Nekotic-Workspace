import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Paperclip,
  Table,
  TextQuote,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { BlockType } from "@/types";

const BLOCK_ICONS: Readonly<Record<BlockType, LucideIcon>> = {
  paragraph: Type,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  quote: TextQuote,
  checklist: ListTodo,
  bulletList: List,
  numberedList: ListOrdered,
  code: Code,
  image: ImageIcon,
  attachment: Paperclip,
  link: Link2,
  table: Table,
  embed: LayoutGrid,
};

export function blockIcon(type: BlockType): LucideIcon {
  return BLOCK_ICONS[type];
}

export const TEXT_BLOCK_CLASS: Readonly<Record<string, string>> = {
  heading1: "text-[26px] font-semibold leading-9 tracking-tight text-foreground",
  heading2: "text-[20px] font-semibold leading-8 tracking-tight text-foreground",
  heading3: "text-[16px] font-semibold leading-7 text-foreground",
  paragraph: "text-[15px] leading-7 text-foreground",
  quote: "text-[15px] leading-7 italic text-muted-foreground",
  checklist: "text-[15px] leading-7 text-foreground",
  bulletList: "text-[15px] leading-7 text-foreground",
  numberedList: "text-[15px] leading-7 text-foreground",
};

export const BLOCK_PLACEHOLDER: Readonly<Record<string, string>> = {
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  paragraph: "Type “/” for commands",
  quote: "Quote",
  checklist: "To-do",
  bulletList: "List item",
  numberedList: "List item",
};
