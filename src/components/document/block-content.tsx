"use client";

import type { KeyboardEvent } from "react";
import { AttachmentBlock } from "@/components/document/blocks/attachment-block";
import { ChecklistBlock } from "@/components/document/blocks/checklist-block";
import { CodeBlock } from "@/components/document/blocks/code-block";
import { EmbedBlock } from "@/components/document/blocks/embed-block";
import { ImageBlock } from "@/components/document/blocks/image-block";
import { LinkBlock } from "@/components/document/blocks/link-block";
import { ListBlock } from "@/components/document/blocks/list-block";
import { TableBlock } from "@/components/document/blocks/table-block";
import { TextBlock } from "@/components/document/blocks/text-block";
import type { BlockEditorApi } from "@/hooks/use-block-editor";
import type { Block } from "@/types";

export interface BlockContentProps {
  readonly block: Block;
  readonly ordinal: number;
  readonly isEditable: boolean;
  readonly api: BlockEditorApi;
  readonly folderId: string | null;
  readonly menu?: { readonly listboxId: string; readonly activeOptionId: string | null };
  readonly onTextChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** Renders the right editor for a block type. */
export function BlockContent({
  block,
  ordinal,
  isEditable,
  api,
  folderId,
  menu,
  onTextChange,
  onKeyDown,
}: BlockContentProps) {
  const focusRequest = api.focusRequest;

  switch (block.type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "paragraph":
    case "quote":
      return (
        <TextBlock
          block={block}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          isEditable={isEditable}
          focusRequest={focusRequest}
          menu={menu}
        />
      );

    case "checklist":
      return (
        <ChecklistBlock
          block={block}
          onChange={onTextChange}
          onToggle={() => api.toggleCheck(block.id)}
          onKeyDown={onKeyDown}
          isEditable={isEditable}
          focusRequest={focusRequest}
          menu={menu}
        />
      );

    case "bulletList":
    case "numberedList":
      return (
        <ListBlock
          block={block}
          ordinal={ordinal}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          isEditable={isEditable}
          focusRequest={focusRequest}
          menu={menu}
        />
      );

    case "code":
      return (
        <CodeBlock
          block={block}
          isEditable={isEditable}
          onChange={(code) => api.patch(block.id, (current) => ({ ...current, code } as Block))}
          onLanguageChange={(language) =>
            api.patch(block.id, (current) => ({ ...current, language } as Block))
          }
          onExit={(direction) => api.focusSibling(block.id, direction)}
        />
      );

    case "image":
      return (
        <ImageBlock
          block={block}
          isEditable={isEditable}
          folderId={folderId}
          onChange={(next) => api.patch(block.id, () => next)}
        />
      );

    case "embed":
      return (
        <EmbedBlock
          block={block}
          isEditable={isEditable}
          onChange={(next) => api.patch(block.id, () => next)}
        />
      );

    case "attachment":
      return (
        <AttachmentBlock
          block={block}
          isEditable={isEditable}
          folderId={folderId}
          onChange={(next) => api.patch(block.id, () => next)}
        />
      );

    case "link":
      return (
        <LinkBlock
          block={block}
          isEditable={isEditable}
          onChange={(next) => api.patch(block.id, () => next)}
        />
      );

    case "table":
      return (
        <TableBlock
          block={block}
          isEditable={isEditable}
          onChange={(next) => api.patch(block.id, () => next)}
        />
      );
  }
}
