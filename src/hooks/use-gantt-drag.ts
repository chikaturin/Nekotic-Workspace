"use client";

import { useCallback, useRef, useState } from "react";
import {
  applyDrag,
  daysFromPixels,
  DRAG_THRESHOLD_PX,
  hasMoved,
  spanDays,
  type GanttDragMode,
  type GanttSchedule,
} from "@/lib/board-gantt";

/**
 * Dragging and resizing a Gantt bar.
 *
 * Three rules shape it:
 *
 *   - **A drag is not a click.** The pointer has to travel before the bar is
 *     considered moved; anything shorter opens the record's drawer instead, so
 *     clicking a bar can never nudge a deadline by a day.
 *   - **The pointer moves pixels, the model moves days.** Every position is
 *     snapped to a whole day before it is shown or written, so a bar cannot
 *     come to rest at 13:37.
 *   - **Nothing is written until the pointer is released.** The bar is moved by
 *     writing its geometry straight onto the element, so a drag re-renders
 *     nothing and issues no request; the mutation happens once, on drop.
 *
 * The floating date label is the only React state, and it changes when the
 * snapped day changes — not when the pointer does.
 */

export interface GanttDragPreview {
  readonly rowId: string;
  readonly mode: GanttDragMode;
  readonly startIso: string;
  readonly endIso: string;
}

export interface GanttDragStart {
  readonly rowId: string;
  readonly mode: GanttDragMode;
  readonly schedule: GanttSchedule;
  /** The bar element, so its geometry can be moved without a render. */
  readonly element: HTMLElement;
}

interface DragSession extends GanttDragStart {
  readonly originX: number;
  readonly dayWidth: number;
  readonly baseLeft: number;
  readonly baseWidth: number;
  days: number;
  hasPassedThreshold: boolean;
}

export interface GanttDrag {
  readonly preview: GanttDragPreview | null;
  readonly begin: (event: React.PointerEvent, start: GanttDragStart) => void;
  readonly isDragging: boolean;
}

interface GanttDragInput {
  readonly dayWidth: number;
  readonly canEdit: boolean;
  /** Called once, on release, only when the range actually changed. */
  readonly onCommit: (rowId: string, range: { startIso: string; endIso: string }) => void;
  /** Called on release when the pointer never travelled far enough to drag. */
  readonly onClick: (rowId: string) => void;
}

export function useGanttDrag({
  dayWidth,
  canEdit,
  onCommit,
  onClick,
}: GanttDragInput): GanttDrag {
  const session = useRef<DragSession | null>(null);
  const [preview, setPreview] = useState<GanttDragPreview | null>(null);

  /** Put the element back under React's control. */
  const release = useCallback((element: HTMLElement) => {
    element.style.left = "";
    element.style.width = "";
  }, []);

  const begin = useCallback(
    (event: React.PointerEvent, start: GanttDragStart) => {
      if (!canEdit || event.button !== 0) return;

      // The bar owns this gesture: without stopping it, the chart's own scroll
      // and the row's click both fire underneath.
      event.preventDefault();
      event.stopPropagation();

      const current: DragSession = {
        ...start,
        originX: event.clientX,
        dayWidth,
        baseLeft: start.schedule.offset * dayWidth,
        baseWidth: start.schedule.span * dayWidth,
        days: 0,
        hasPassedThreshold: false,
      };

      session.current = current;
      start.element.setPointerCapture(event.pointerId);

      const move = (moveEvent: PointerEvent) => {
        const active = session.current;
        if (!active) return;

        const travelled = moveEvent.clientX - active.originX;
        if (Math.abs(travelled) >= DRAG_THRESHOLD_PX) active.hasPassedThreshold = true;
        if (!active.hasPassedThreshold) return;

        const days = daysFromPixels(travelled, active.dayWidth);
        if (days === active.days) return;
        active.days = days;

        const next = applyDrag(active.schedule, active.mode, days);
        const width = spanDays(next.startIso, next.endIso) * active.dayWidth;

        // Geometry straight onto the element: no render, no request, and no
        // dependence on how many rows happen to be mounted.
        if (active.mode === "move") {
          active.element.style.left = `${active.baseLeft + days * active.dayWidth}px`;
        } else if (active.mode === "resize-start") {
          // The right edge is the anchor, so the left one follows the width.
          active.element.style.left = `${active.baseLeft + active.baseWidth - width}px`;
          active.element.style.width = `${width}px`;
        } else {
          active.element.style.width = `${width}px`;
        }

        // The label is the only React state, and it moves a day at a time.
        setPreview({ rowId: active.rowId, mode: active.mode, ...next });
      };

      const finish = (upEvent: PointerEvent) => {
        const active = session.current;
        session.current = null;
        setPreview(null);

        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);

        if (!active) return;
        if (active.element.hasPointerCapture(upEvent.pointerId)) {
          active.element.releasePointerCapture(upEvent.pointerId);
        }
        release(active.element);

        if (!active.hasPassedThreshold) {
          onClick(active.rowId);
          return;
        }

        const next = applyDrag(active.schedule, active.mode, active.days);
        if (hasMoved(active.schedule, next)) onCommit(active.rowId, next);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [canEdit, dayWidth, onCommit, onClick, release],
  );

  return { preview, begin, isDragging: preview !== null };
}
