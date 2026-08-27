"use client";

import { Check } from "lucide-react";
import type { KeyboardEvent } from "react";
import { EditableText } from "@/components/document/blocks/editable-text";
import { BLOCK_PLACEHOLDER, TEXT_BLOCK_CLASS } from "@/lib/block-visuals";
import { cn } from "@/lib/utils";
import type { ChecklistBlock as ChecklistBlockModel, FocusRequest } from "@/types";

interface ChecklistBlockProps {
  readonly block: ChecklistBlockModel;
  readonly onChange: (value: string) => void;
  readonly onToggle: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly isEditable: boolean;
  readonly focusRequest: FocusRequest | null;
  readonly menu?: { readonly listboxId: string; readonly activeOptionId: string | null };
}

export function ChecklistBlock({
  block,
  onChange,
  onToggle,
  onKeyDown,
  isEditable,
  focusRequest,
  menu,
}: ChecklistBlockProps) {
  return (
    <div className="flex gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={block.isChecked}
        aria-label={block.text || "To-do item"}
        disabled={!isEditable}
        onClick={onToggle}
        className={cn(
          "mt-[5px] flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors",
          block.isChecked
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border-strong bg-surface hover:border-accent",
          !isEditable && "cursor-default is-disabled",
        )}
      >
        {block.isChecked && <Check className="size-3" strokeWidth={3} />}
      </button>

      <EditableText
        blockId={block.id}
        value={block.text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        isEditable={isEditable}
        focusRequest={focusRequest}
        placeholder={BLOCK_PLACEHOLDER.checklist ?? ""}
        className={cn(
          TEXT_BLOCK_CLASS.checklist,
          block.isChecked && "text-faint-foreground line-through",
        )}
        ariaLabel="To-do text"
        menu={menu}
      />
    </div>
  );
}
