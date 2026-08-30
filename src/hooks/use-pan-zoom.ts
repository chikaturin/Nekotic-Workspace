"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  centerOf,
  clampScale,
  clampTransform,
  fitScale,
  fitTransform,
  IDENTITY,
  isMeasured,
  toCssTransform,
  zoomAt,
  zoomBy,
  type Point,
  type Size,
  type Transform,
} from "@/lib/pan-zoom";

export interface PanZoomOptions {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly stageRef: RefObject<HTMLElement | null>;
  readonly allowUpscale?: boolean;
}

export interface PanZoom {
  readonly scale: number;
  readonly setContentSize: (size: Size) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly fit: () => void;
  readonly actualSize: () => void;
  readonly isFitted: boolean;
  readonly handlers: {
    readonly onPointerDown: (event: React.PointerEvent) => void;
    readonly onPointerMove: (event: React.PointerEvent) => void;
    readonly onPointerUp: (event: React.PointerEvent) => void;
    readonly onDoubleClick: (event: React.MouseEvent) => void;
  };
}

const WHEEL_SENSITIVITY = 0.0025;
const DOUBLE_CLICK_FACTOR = 2;
const BUTTON_FACTOR = 1.2;

export function usePanZoom({
  viewportRef,
  stageRef,
  allowUpscale = false,
}: PanZoomOptions): PanZoom {
  const transform = useRef<Transform>(IDENTITY);
  const content = useRef<Size | null>(null);
  const viewport = useRef<Size | null>(null);
  const frame = useRef<number | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const hasFitted = useRef(false);
  const isFittedRef = useRef(true);

  const [scale, setScale] = useState(1);
  const [isFitted, setIsFitted] = useState(true);

  const paint = useCallback(() => {
    if (frame.current !== null) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const stage = stageRef.current;
      if (stage) stage.style.transform = toCssTransform(transform.current);
    });
  }, [stageRef]);

  const commit = useCallback(
    (next: Transform, { fitted = false }: { fitted?: boolean } = {}) => {
      const box = content.current;
      const frameSize = viewport.current;

      transform.current =
        isMeasured(box) && isMeasured(frameSize)
          ? clampTransform(next, box, frameSize)
          : next;

      paint();

      setScale((current) =>
        Math.abs(current - transform.current.scale) < 0.0001 ? current : transform.current.scale,
      );
      isFittedRef.current = fitted;
      setIsFitted(fitted);
    },
    [paint],
  );

  const applyFit = useCallback(() => {
    const box = content.current;
    const frameSize = viewport.current;
    if (!isMeasured(box) || !isMeasured(frameSize)) return;

    hasFitted.current = true;
    commit(fitTransform(box, frameSize, { allowUpscale }), { fitted: true });
  }, [commit, allowUpscale]);

  const setContentSize = useCallback(
    (size: Size) => {
      content.current = size;
      if (!hasFitted.current) applyFit();
    },
    [applyFit],
  );

  const zoomAtPoint = useCallback(
    (factor: number, anchor?: Point) => {
      const frameSize = viewport.current;
      const at = anchor ?? (isMeasured(frameSize) ? centerOf(frameSize) : { x: 0, y: 0 });
      commit(zoomBy(transform.current, factor, at));
    },
    [commit],
  );

  const zoomIn = useCallback(() => zoomAtPoint(BUTTON_FACTOR), [zoomAtPoint]);
  const zoomOut = useCallback(() => zoomAtPoint(1 / BUTTON_FACTOR), [zoomAtPoint]);

  const actualSize = useCallback(() => {
    const frameSize = viewport.current;
    const at = isMeasured(frameSize) ? centerOf(frameSize) : { x: 0, y: 0 };
    commit(zoomAt(transform.current, 1, at));
  }, [commit]);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage) stage.style.transform = toCssTransform(transform.current);
  }, [stageRef]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;

      viewport.current = { width: rect.width, height: rect.height };
      if (!hasFitted.current) {
        applyFit();
        return;
      }

      if (isFittedRef.current) applyFit();
      else commit(transform.current);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [applyFit, commit, viewportRef]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();

      const rect = node?.getBoundingClientRect();
      if (!rect) return;

      const anchor: Point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY * (event.ctrlKey ? 2 : 1));
      commit(zoomBy(transform.current, factor, anchor));
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [commit, viewportRef]);

  const localPoint = useCallback((event: { clientX: number; clientY: number }): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, [viewportRef]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, localPoint(event));

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (a && b) {
          pinch.current = {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            scale: transform.current.scale,
          };
        }
      }

      viewportRef.current?.classList.add("is-grabbing");
    },
    [localPoint, viewportRef],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;

      const point = localPoint(event);
      pointers.current.set(event.pointerId, point);

      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;

        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance <= 0) return;

        const next = clampScale(pinch.current.scale * (distance / pinch.current.distance));
        commit(zoomAt(transform.current, next, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
        return;
      }

      commit({
        scale: transform.current.scale,
        x: transform.current.x + (point.x - previous.x),
        y: transform.current.y + (point.y - previous.y),
      });
    },
    [commit, localPoint],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointers.current.size === 0) {
      viewportRef.current?.classList.remove("is-grabbing");
    }
  }, [viewportRef]);

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const factor = event.altKey || event.metaKey ? 1 / DOUBLE_CLICK_FACTOR : DOUBLE_CLICK_FACTOR;
      commit(zoomBy(transform.current, factor, localPoint(event)));
    },
    [commit, localPoint],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return {
    scale,
    setContentSize,
    zoomIn,
    zoomOut,
    fit: applyFit,
    actualSize,
    isFitted,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick },
  };
}

export { fitScale };
