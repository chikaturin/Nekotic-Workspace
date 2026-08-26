"use client";

import { motion } from "framer-motion";
import { GROUP_LABELS, type BlockCommand } from "@/lib/block-commands";
import { blockIcon } from "@/lib/block-visuals";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/types";

interface SlashMenuProps {
  readonly results: readonly BlockCommand[];
  readonly activeIndex: number;
  readonly onSelect: (type: BlockType) => void;
  readonly onHover: (index: number) => void;
  /** Referenced by the editor's `aria-controls`. */
  readonly listboxId: string;
  /** Builds the option ids the editor points `aria-activedescendant` at. */
  readonly optionId: (index: number) => string;
}

/** Command palette for block insertion, anchored under the active block. */
export function SlashMenu({
  results,
  activeIndex,
  onSelect,
  onHover,
  listboxId,
  optionId,
}: SlashMenuProps) {
  if (results.length === 0) {
    return (
      <MenuShell>
        <p className="px-2 py-3 text-center text-[13px] text-muted-foreground">
          No blocks match that search
        </p>
      </MenuShell>
    );
  }

  return (
    <MenuShell>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Block types"
        className="max-h-72 overflow-y-auto p-1"
      >
        {results.map((command, index) => {
          const Icon = blockIcon(command.type);
          const showHeading = index === 0 || results[index - 1]?.group !== command.group;

          return (
            <li key={command.type}>
              {showHeading && (
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint-foreground">
                  {GROUP_LABELS[command.group]}
                </p>
              )}

              <button
                type="button"
                role="option"
                id={optionId(index)}
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => {
                  // Keep the caret in the block the menu was opened from.
                  event.preventDefault();
                  onSelect(command.type);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                  index === activeIndex ? "bg-hover" : "hover:bg-hover",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
                  <Icon className="size-3.5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-foreground">{command.label}</span>
                  <span className="block truncate text-[11px] text-faint-foreground">
                    {command.description}
                  </span>
                </span>
                {command.markdownPrefix && (
                  <span className="metric shrink-0 text-[10px] text-faint-foreground">
                    {command.markdownPrefix}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </MenuShell>
  );
}

function MenuShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-elevated shadow-2xl"
    >
      {children}
    </motion.div>
  );
}
