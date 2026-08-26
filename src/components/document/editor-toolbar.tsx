"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BLOCK_COMMANDS } from "@/lib/block-commands";
import { blockIcon } from "@/lib/block-visuals";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/types";

/** Blocks worth a one-click button; the rest live behind the slash menu. */
const QUICK_BLOCKS: readonly BlockType[] = [
  "heading1",
  "heading2",
  "paragraph",
  "checklist",
  "bulletList",
  "numberedList",
  "quote",
  "code",
  "table",
  "image",
  "attachment",
  "link",
  "embed",
];

interface EditorToolbarProps {
  readonly onInsert: (type: BlockType) => void;
  /** Locked pages disable every control rather than hiding them. */
  readonly isDisabled: boolean;
  readonly className?: string;
}

export function EditorToolbar({ onInsert, isDisabled, className }: EditorToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  /** Roving tabindex: the toolbar is one tab stop, arrows move inside it. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;

    event.preventDefault();
    const next = (activeIndex + delta + QUICK_BLOCKS.length) % QUICK_BLOCKS.length;
    setActiveIndex(next);

    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.item(next)?.focus();
  }

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Insert block"
      aria-disabled={isDisabled}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-1",
        isDisabled && "opacity-60",
        className,
      )}
    >
      {QUICK_BLOCKS.map((type, index) => {
        const command = BLOCK_COMMANDS.find((candidate) => candidate.type === type);
        const Icon = blockIcon(type);

        return (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={isDisabled}
                tabIndex={index === activeIndex ? 0 : -1}
                aria-label={`Insert ${command?.label ?? type}`}
                onFocus={() => setActiveIndex(index)}
                onClick={() => onInsert(type)}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{command?.label ?? type}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
