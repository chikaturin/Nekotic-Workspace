"use client";

import { TriangleAlert } from "lucide-react";
import { useRef } from "react";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import type { GanttRow } from "@/lib/board-gantt";
import { RESIZE_HANDLE_PX } from "@/lib/board-gantt";
import type { GanttDrag } from "@/hooks/use-gantt-drag";
import { shortDayLabel } from "@/lib/board-dates";
import { cn } from "@/lib/utils";
import type { SelectColor } from "@/types";

interface GanttBarProps {
  readonly row: GanttRow;
  readonly dayWidth: number;
  readonly label: string;
  /** Status colour from the record's own Select option — never a literal. */
  readonly color: SelectColor | null;
  readonly canEdit: boolean;
  readonly isOpen: boolean;
  readonly hasConflict: boolean;
  readonly tooltip: string;
  readonly drag: GanttDrag;
}

/**
 * One record's bar.
 *
 * Its colour comes from the record's own Status option, so the chart reads the
 * same as the board rather than inventing a palette. Progress, when the
 * subtasks can supply it, fills from the left.
 *
 * Editing is direct: drag the middle to move the whole range, drag either edge
 * to move that date alone. A summary bar — a parent showing where its children
 * sit — is not draggable, because those dates belong to the children.
 */
export function GanttBar({
  row,
  dayWidth,
  label,
  color,
  canEdit,
  isOpen,
  hasConflict,
  tooltip,
  drag,
}: GanttBarProps) {
  const element = useRef<HTMLDivElement>(null);
  const { schedule } = row;
  if (!schedule) return null;

  /** A summary is derived from its children, so it is read-only by nature. */
  const isEditable = canEdit && !row.isDerived;
  const isPreviewing = drag.preview?.rowId === row.rowId;

  function startDrag(event: React.PointerEvent, mode: "move" | "resize-start" | "resize-end") {
    if (!isEditable || !element.current || !schedule) return;
    drag.begin(event, { rowId: row.rowId, mode, schedule, element: element.current });
  }

  if (row.kind === "point") {
    return (
      <div
        ref={element}
        title={tooltip}
        onPointerDown={(event) => startDrag(event, "move")}
        style={{ left: schedule.offset * dayWidth, width: dayWidth }}
        className={cn(
          "absolute top-1 flex h-7 items-center justify-center",
          isEditable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
        )}
      >
        {/* A single-day record is a moment, so it is drawn as one. */}
        <span
          className={cn(
            "size-3.5 rotate-45 rounded-[2px] border",
            color ? SELECT_COLOR_CLASSES[color] : "border-accent/50 bg-accent/30",
            isOpen && "ring-1 ring-accent",
          )}
        />
      </div>
    );
  }

  return (
    <div
      ref={element}
      role="button"
      tabIndex={0}
      aria-label={tooltip}
      title={tooltip}
      onPointerDown={(event) => startDrag(event, "move")}
      style={{ left: schedule.offset * dayWidth, width: schedule.span * dayWidth }}
      className={cn(
        "group/bar absolute top-1.5 flex h-6 min-w-2 items-center overflow-hidden rounded-md border",
        row.isDerived
          ? "border-dashed border-border-strong bg-hover"
          : color
            ? SELECT_COLOR_CLASSES[color]
            : "border-accent/40 bg-accent/20",
        row.isPartial && "border-dashed",
        isOpen && "ring-1 ring-accent",
        isPreviewing && "opacity-80 ring-1 ring-accent",
        isEditable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      {row.progress && (
        <span
          aria-hidden
          style={{ width: `${row.progress.percent}%` }}
          className="absolute inset-y-0 left-0 bg-foreground/12"
        />
      )}

      <span className="metric relative truncate px-1.5 text-[10px] text-foreground">
        {hasConflict && <TriangleAlert className="mr-1 inline size-2.5 text-warning" />}
        {row.isDerived
          ? `${shortDayLabel(schedule.startIso)} → ${shortDayLabel(schedule.endIso)}`
          : label}
      </span>

      {isEditable && (
        <>
          <ResizeHandle side="start" onPointerDown={(event) => startDrag(event, "resize-start")} />
          <ResizeHandle side="end" onPointerDown={(event) => startDrag(event, "resize-end")} />
        </>
      )}
    </div>
  );
}

/**
 * The grab zone for one end. It only appears on hover, so a bar reads as a bar
 * until you go looking for its edge.
 */
function ResizeHandle({
  side,
  onPointerDown,
}: {
  readonly side: "start" | "end";
  readonly onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <span
      onPointerDown={onPointerDown}
      aria-hidden
      style={{ width: RESIZE_HANDLE_PX }}
      className={cn(
        "absolute inset-y-0 cursor-ew-resize touch-none opacity-0 transition-opacity",
        "group-hover/bar:opacity-100 bg-foreground/20",
        side === "start" ? "left-0 rounded-l-md" : "right-0 rounded-r-md",
      )}
    />
  );
}
