"use client";

import { useMemo } from "react";
import { BlockRow } from "@/components/document/block-row";
import { useBlockDnd } from "@/hooks/use-block-dnd";
import type { BlockEditorApi } from "@/hooks/use-block-editor";
import { useSlashMenu } from "@/hooks/use-slash-menu";
import { cn } from "@/lib/utils";
import type { Block } from "@/types";

interface BlockEditorProps {
  readonly blocks: readonly Block[];
  /** Owned by the page so the toolbar and title can drive it too. */
  readonly api: BlockEditorApi;
  readonly isEditable: boolean;
  /** Folder that image and attachment uploads are filed into. */
  readonly folderId: string | null;
}

/**
 * The editor surface: a list of blocks with slash commands, drag reordering and
 * keyboard-first editing. All structural rules come from `useBlockEditor`.
 */
export function BlockEditor({ blocks, api, isEditable, folderId }: BlockEditorProps) {
  const slashMenu = useSlashMenu();
  const dnd = useBlockDnd(api.moveToInsertionIndex, isEditable);

  /** Numbered lists restart after any non-numbered block. */
  const ordinals = useMemo(() => {
    const result: number[] = [];

    for (const block of blocks) {
      const previous = result[result.length - 1] ?? 0;
      result.push(block.type === "numberedList" ? previous + 1 : 0);
    }

    return result;
  }, [blocks]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-0.5">
        {blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            index={index}
            ordinal={ordinals[index] ?? 0}
            isEditable={isEditable}
            api={api}
            slashMenu={slashMenu}
            dnd={dnd}
            indicator={dnd.indicator}
            isDragging={dnd.draggingBlockId === block.id}
            folderId={folderId}
          />
        ))}
      </div>

      {isEditable && (
        <button
          type="button"
          onClick={() => api.appendBlock()}
          className={cn(
            "mt-1 h-16 rounded-md pl-12 text-left text-[13px] text-transparent transition-colors",
            "hover:text-faint-foreground focus-visible:text-faint-foreground focus-visible:outline-none",
          )}
        >
          Click here to add a block
        </button>
      )}
    </div>
  );
}
