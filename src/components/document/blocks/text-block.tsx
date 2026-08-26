"use client";

import type { KeyboardEvent } from "react";
import { EditableText } from "@/components/document/blocks/editable-text";
import { BLOCK_PLACEHOLDER, TEXT_BLOCK_CLASS } from "@/lib/block-visuals";
import { cn } from "@/lib/utils";
import type { FocusRequest, TextBlock as TextBlockModel } from "@/types";

interface TextBlockProps {
  readonly block: TextBlockModel;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly isEditable: boolean;
  readonly focusRequest: FocusRequest | null;
  readonly menu?: { readonly listboxId: string; readonly activeOptionId: string | null };
}

/** Headings, paragraphs and quotes — same mechanics, different typography. */
export function TextBlock({
  block,
  onChange,
  onKeyDown,
  isEditable,
  focusRequest,
  menu,
}: TextBlockProps) {
  const isQuote = block.type === "quote";

  return (
    <div className={cn(isQuote && "border-l-2 border-accent pl-3")}>
      <EditableText
        blockId={block.id}
        value={block.text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        isEditable={isEditable}
        focusRequest={focusRequest}
        placeholder={BLOCK_PLACEHOLDER[block.type] ?? ""}
        className={TEXT_BLOCK_CLASS[block.type]}
        ariaLabel={`${block.type} block`}
        menu={menu}
      />
    </div>
  );
}
