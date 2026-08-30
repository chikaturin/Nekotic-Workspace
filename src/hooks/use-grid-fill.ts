"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GridSlice } from "@/lib/grid-clipboard";
import { planFill } from "@/lib/grid-fill";
import { rangeBox, type CellAddress, type GridBounds } from "@/lib/grid-selection";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX = 14;

interface UseGridFillInput {
  readonly slice: GridSlice;
  readonly bounds: GridBounds;
  readonly recordIndexAt: (offsetY: number) => number | null;
  readonly scrollRef: React.RefObject<HTMLElement | null>;
  readonly columnAt: (clientX: number) => number | null;
  readonly isReadOnly?: boolean;
}

export interface GridFillController {
  readonly onHandlePointerDown: (event: React.PointerEvent) => void;
}

export function useGridFill({
  slice,
  bounds,
  recordIndexAt,
  scrollRef,
  columnAt,
  isReadOnly = false,
}: UseGridFillInput): GridFillController {
  const editCells = useBoardStore((state) => state.editCells);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const drag = useRef<{
    readonly pointerId: number;
    pointer: CellAddress;
    clientY: number;
    clientX: number;
    frame: number | null;
    detach: () => void;
  } | null>(null);

  const latest = useRef({ slice, bounds, recordIndexAt, columnAt });

  useEffect(() => {
    latest.current = { slice, bounds, recordIndexAt, columnAt };
  });

  const addressAt = useCallback(
    (clientX: number, clientY: number): CellAddress | null => {
      const scroller = scrollRef.current;
      const { bounds: box, recordIndexAt: findRecord, columnAt: findColumn } = latest.current;

      if (!scroller) return null;

      const rect = scroller.getBoundingClientRect();
      const record = findRecord(clientY - rect.top + scroller.scrollTop);
      const columnIndex = findColumn(clientX);

      if (record === null || columnIndex === null) return null;

      return {
        rowIndex: Math.min(Math.max(record, 0), Math.max(0, box.rowCount - 1)),
        columnIndex,
      };
    },
    [scrollRef],
  );

  const loop = useRef<() => void>(() => {});

  const step = useCallback(() => {
    const state = drag.current;
    const scroller = scrollRef.current;

    if (!state || !scroller) return;

    const rect = scroller.getBoundingClientRect();
    const belowBy = state.clientY - (rect.bottom - AUTO_SCROLL_EDGE);
    const aboveBy = rect.top + AUTO_SCROLL_EDGE - state.clientY;

    if (belowBy > 0) {
      scroller.scrollTop += Math.min(belowBy / 3, AUTO_SCROLL_MAX);
    } else if (aboveBy > 0) {
      scroller.scrollTop -= Math.min(aboveBy / 3, AUTO_SCROLL_MAX);
    }

    const address = addressAt(state.clientX, state.clientY);

    if (address) {
      state.pointer = address;
      const fill = useGridStore.getState().fill;

      if (fill) {
        const target = planFill({
          slice: latest.current.slice,
          source: fill.source,
          pointer: address,
        });

        useGridStore.getState().setFillPreview(target?.preview ?? fill.source);
      }
    }

    state.frame = requestAnimationFrame(() => loop.current());
  }, [addressAt, scrollRef]);

  useEffect(() => {
    loop.current = step;
  }, [step]);

  const finish = useCallback(
    (commit: boolean) => {
      const state = drag.current;
      const fill = useGridStore.getState().fill;

      drag.current = null;
      state?.detach();
      if (state?.frame !== null && state?.frame !== undefined) {
        cancelAnimationFrame(state.frame);
      }

      useGridStore.getState().endFill();

      if (!commit || !state || !fill) return;

      const plan = planFill({
        slice: latest.current.slice,
        source: fill.source,
        pointer: state.pointer,
      });

      if (!plan || plan.edits.length === 0) {
        if (plan && plan.blocked > 0) {
          pushFeedback(
            `${plan.blocked} ô không điền được — cột không nhận giá trị này`,
            "info",
          );
        }
        return;
      }

      void editCells(plan.edits);

      if (plan.blocked > 0) {
        pushFeedback(
          `Đã điền ${plan.edits.length} ô; ${plan.blocked} ô bị bỏ qua vì cột không nhận giá trị này`,
          "info",
        );
      }
    },
    [editCells, pushFeedback],
  );

  useEffect(() => () => drag.current?.detach(), []);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const range = useGridStore.getState().range;

      if (isReadOnly || !range) return;

      event.preventDefault();
      event.stopPropagation();

      const source = rangeBox(range);
      const pointerId = event.pointerId;

      const onMove = (moveEvent: PointerEvent) => {
        const state = drag.current;

        if (!state || moveEvent.pointerId !== pointerId) return;

        state.clientX = moveEvent.clientX;
        state.clientY = moveEvent.clientY;
      };

      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        finish(true);
      };

      const onKey = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Escape") return;

        keyEvent.preventDefault();
        finish(false);
      };

      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("keydown", onKey);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKey);

      drag.current = {
        pointerId,
        pointer: { rowIndex: source.bottom, columnIndex: source.right },
        clientX: event.clientX,
        clientY: event.clientY,
        frame: null,
        detach,
      };

      useGridStore.getState().beginFill(source);
      drag.current.frame = requestAnimationFrame(() => loop.current());
    },
    [isReadOnly, finish],
  );

  return { onHandlePointerDown };
}
