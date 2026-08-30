"use client";

import { ChevronRight } from "lucide-react";
import { memo } from "react";
import { GUTTER_WIDTH } from "@/components/board/table/grid-shared";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { UNGROUPED_KEY } from "@/lib/board-grouping";
import { cn } from "@/lib/utils";
import type { SelectColor } from "@/types";

interface GroupHeaderProps {
  readonly label: string;
  readonly groupKey: string;
  readonly color?: SelectColor;
  readonly count: number;
  readonly isCollapsed: boolean;
  readonly height: number;
  readonly groupColumnName: string;
  readonly onToggle: () => void;
}

export const GroupHeader = memo(function GroupHeader({
  label,
  groupKey,
  color,
  count,
  isCollapsed,
  height,
  groupColumnName,
  onToggle,
}: GroupHeaderProps) {
  const isEmptyBucket = groupKey === UNGROUPED_KEY;

  return (
    <div style={{ height }} className="flex w-max border-b border-border bg-surface/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        style={{ paddingLeft: GUTTER_WIDTH - 28 }}
        className="sticky left-0 z-sticky flex items-center gap-2 bg-surface/95 px-3 text-left backdrop-blur"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-faint-foreground transition-transform",
            !isCollapsed && "rotate-90",
          )}
        />

        {color ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-body font-medium",
              SELECT_COLOR_CLASSES[color],
            )}
          >
            {label}
          </span>
        ) : (
          <span
            className={cn(
              "text-ui font-medium",
              isEmptyBucket ? "text-faint-foreground" : "text-foreground",
            )}
          >
            {isEmptyBucket ? `No ${groupColumnName.toLowerCase()}` : label}
          </span>
        )}

        <span className="metric text-body text-faint-foreground">{count}</span>
      </button>
    </div>
  );
});
