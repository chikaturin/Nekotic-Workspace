"use client";

import type { KeyboardEvent } from "react";
import { EditableText } from "@/components/document/blocks/editable-text";
import { BLOCK_PLACEHOLDER, TEXT_BLOCK_CLASS } from "@/lib/block-visuals";
import type { FocusRequest, ListBlock as ListBlockModel } from "@/types";

interface ListBlockProps {
  readonly block: ListBlockModel;
  /** 1-based position within the current run of numbered items. */
  readonly ordinal: number;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly isEditable: boolean;
  readonly focusRequest: FocusRequest | null;
  readonly menu?: { readonly listboxId: string; readonly activeOptionId: string | null };
}

export function ListBlock({
  block,
  ordinal,
  onChange,
  onKeyDown,
  isEditable,
  focusRequest,
  menu,
}: ListBlockProps) {
  const marker = block.type === "numberedList" ? `${ordinal}.` : "•";

  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden
        className="metric mt-[3px] w-4 shrink-0 select-none text-right text-[13px] text-faint-foreground"
      >
        {marker}
      </span>
      <EditableText
        blockId={block.id}
        value={block.text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        isEditable={isEditable}
        focusRequest={focusRequest}
        placeholder={BLOCK_PLACEHOLDER[block.type] ?? ""}
        className={TEXT_BLOCK_CLASS[block.type]}
        ariaLabel="List item"
        menu={menu}
      />
    </div>
  );
}
