"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarSectionProps {
  readonly title: string;
  readonly isCollapsed: boolean;
  readonly action?: ReactNode;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Labelled, collapsible group of sidebar rows. Hidden when the rail is narrow. */
export function SidebarSection({
  title,
  isCollapsed,
  action,
  defaultOpen = true,
  children,
  className,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isCollapsed) {
    return (
      <div className={cn("flex shrink-0 flex-col items-center gap-0.5", className)}>{children}</div>
    );
  }

  return (
    /**
     * `shrink-0` is what makes the rail scroll.
     *
     * The sidebar's scroll area is a flex column, so a section left at the
     * default `flex-shrink: 1` compresses to fit instead of overflowing — the
     * container then never exceeds its height, never scrolls, and the inner
     * `overflow-hidden` (which the collapse animation needs) quietly clips
     * whatever was squeezed out. Keeping each section at its natural height
     * lets the column overflow, which is what produces the scrollbar.
     */
    <section className={cn("flex shrink-0 flex-col", className)}>
      <div className="flex h-7 items-center gap-1 pl-1 pr-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
          className="group flex min-w-0 flex-1 items-center gap-1 rounded text-[10px] font-semibold uppercase tracking-wider text-faint-foreground outline-none transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn("size-3 transition-transform duration-200", isOpen && "rotate-90")}
          />
          <span className="truncate">{title}</span>
        </button>
        {action}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-0 overflow-hidden"
          >
            <div className="flex min-h-0 flex-col gap-0.5 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
