"use client";

import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Ellipsis,
  GripVertical,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { BlockContent } from "@/components/document/block-content";
import { SlashMenu } from "@/components/document/slash-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BLOCK_COMMANDS } from "@/lib/block-commands";
import { blockIcon } from "@/lib/block-visuals";
import { getCaretOffset, hasTextSelection, isCaretAtEnd, isCaretAtStart } from "@/lib/dom/caret";
import { isTextualBlock } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import type { BlockDnd, BlockDropIndicator } from "@/hooks/use-block-dnd";
import type { BlockEditorApi } from "@/hooks/use-block-editor";
import type { SlashMenu as SlashMenuState } from "@/hooks/use-slash-menu";
import type { Block, BlockType } from "@/types";

interface BlockRowProps {
  readonly block: Block;
  readonly index: number;
  readonly ordinal: number;
  readonly isEditable: boolean;
  readonly api: BlockEditorApi;
  readonly slashMenu: SlashMenuState;
  readonly dnd: BlockDnd;
  readonly indicator: BlockDropIndicator | null;
  readonly isDragging: boolean;
  readonly folderId: string | null;
}

export function BlockRow({
  block,
  index,
  ordinal,
  isEditable,
  api,
  slashMenu,
  dnd,
  indicator,
  isDragging,
  folderId,
}: BlockRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isMenuOpen = slashMenu.isOpen && slashMenu.blockId === block.id;
  const isTextual = isTextualBlock(block);

  const listboxId = `slash-menu-${block.id}`;
  const optionId = useCallback(
    (index: number) => `slash-option-${block.id}-${index}`,
    [block.id],
  );

  const menu = isMenuOpen
    ? {
        listboxId,
        activeOptionId: slashMenu.activeCommand ? optionId(slashMenu.activeIndex) : null,
      }
    : undefined;

  const focusNonce = api.focusRequest?.nonce ?? 0;
  const isFocusTarget = api.focusRequest?.blockId === block.id;

  useEffect(() => {
    if (isTextual || !isFocusTarget) return;

    const row = rowRef.current;
    if (!row) return;

    const control = row.querySelector<HTMLElement>("textarea, input:not([type='hidden'])");
    (control ?? row).focus({ preventScroll: true });
  }, [isTextual, isFocusTarget, focusNonce]);

  const handleTextChange = useCallback(
    (value: string) => {
      if (value.startsWith("/") && isTextualBlock(block)) {
        if (!isMenuOpen) slashMenu.open(block.id);
        slashMenu.setQuery(value.slice(1));
      } else if (isMenuOpen) {
        slashMenu.close();
      }

      api.setText(block.id, value);
    },
    [api, block, isMenuOpen, slashMenu],
  );

  const applyCommand = useCallback(
    (type: BlockType) => {
      slashMenu.close();
      api.applyCommand(block.id, type);
    },
    [api, block.id, slashMenu],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const element = event.currentTarget;

      if (isMenuOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          slashMenu.moveActive(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          slashMenu.moveActive(-1);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          if (slashMenu.activeCommand) applyCommand(slashMenu.activeCommand.type);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          slashMenu.close();
          return;
        }
      }

      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        api.moveBy(block.id, event.key === "ArrowUp" ? -1 : 1);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && block.type === "checklist") {
        event.preventDefault();
        api.toggleCheck(block.id);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        api.splitAt(block.id, getCaretOffset(element));
        return;
      }

      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        document.execCommand("insertText", false, "\n");
        return;
      }

      if (event.key === "Backspace" && !hasTextSelection() && isCaretAtStart(element)) {
        event.preventDefault();
        api.mergeBackward(block.id);
        return;
      }

      if (event.key === "ArrowUp" && isCaretAtStart(element)) {
        event.preventDefault();
        api.focusSibling(block.id, -1);
        return;
      }

      if (event.key === "ArrowDown" && isCaretAtEnd(element)) {
        event.preventDefault();
        api.focusSibling(block.id, 1);
      }
    },
    [api, applyCommand, block.id, block.type, isMenuOpen, slashMenu],
  );

  const showIndicatorBefore = indicator?.index === index && indicator.side === "before";
  const showIndicatorAfter = indicator?.index === index && indicator.side === "after";

  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      data-block-id={block.id}
      onDragOver={dnd.onDragOver(index)}
      onDrop={dnd.onDrop(index)}
      className={cn(
        "group/block relative flex gap-1 rounded-md outline-none transition-opacity",
        "focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "is-dragging",
      )}
    >
      {showIndicatorBefore && <DropLine position="top" />}
      {showIndicatorAfter && <DropLine position="bottom" />}

      {!isEditable && <span className="w-[4.5rem] shrink-0" aria-hidden />}

      {isEditable && (
      <div
        className={cn(
          "flex w-[4.5rem] shrink-0 items-start justify-end gap-0.5 pt-1 transition-opacity",
          "opacity-0 focus-within:opacity-100 group-hover/block:opacity-100",
        )}
      >
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Insert block below"
          onClick={() => api.insertAfter(block.id, "paragraph")}
        >
          <Plus />
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Drag to reorder ${block.type} block`}
          draggable={isEditable}
          onDragStart={(event) => {
            if (rowRef.current) event.dataTransfer.setDragImage(rowRef.current, 12, 12);
            dnd.onDragStart(block.id)(event);
          }}
          onDragEnd={dnd.onDragEnd}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Block options for ${block.type}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Shuffle />
                Turn into
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                {BLOCK_COMMANDS.map((command) => {
                  const Icon = blockIcon(command.type);
                  return (
                    <DropdownMenuItem
                      key={command.type}
                      onSelect={() => api.convert(block.id, command.type)}
                    >
                      <Icon />
                      {command.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem onSelect={() => api.duplicate(block.id)}>
              <CopyPlus />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => api.moveBy(block.id, -1)}>
              <ArrowUp />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => api.moveBy(block.id, 1)}>
              <ArrowDown />
              Move down
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" onSelect={() => api.remove(block.id)}>
              <Trash2 />
              Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}

      <div className="relative min-w-0 flex-1 py-0.5">
        <BlockContent
          block={block}
          ordinal={ordinal}
          isEditable={isEditable}
          api={api}
          folderId={folderId}
          menu={menu}
          onTextChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />

        {isMenuOpen && (
          <SlashMenu
            results={slashMenu.results}
            activeIndex={slashMenu.activeIndex}
            listboxId={listboxId}
            optionId={optionId}
            onSelect={applyCommand}
            onHover={(hoveredIndex) => slashMenu.moveActive(hoveredIndex - slashMenu.activeIndex)}
          />
        )}
      </div>
    </div>
  );
}

function DropLine({ position }: { position: "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-[4.5rem] right-0 h-0.5 rounded-full bg-accent",
        position === "top" ? "-top-0.5" : "-bottom-0.5",
      )}
    />
  );
}
