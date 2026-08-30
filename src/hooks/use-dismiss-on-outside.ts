"use client";

import { useEffect, type RefObject } from "react";

const LAYERED = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  "[data-radix-popper-content-wrapper]",
].join(",");

function isLayerAbove(layer: Element, panel: HTMLElement): boolean {
  return !layer.contains(panel);
}

/**
 * Đóng một panel khi bấm ra ngoài hoặc bấm Escape.
 *
 * `onDismiss` nhận `null` khi panel KHÔNG muốn bị đóng kiểu đó, và khi ấy hook
 * không đăng ký gì cả. Đây không phải chuyện dọn dẹp cho gọn: nhánh Escape gọi
 * `stopPropagation` ở pha CAPTURE trên document, nên một handler rỗng vẫn NUỐT
 * phím Escape trước khi nó tới được ô đang gõ — panel không đóng, và cũng không
 * ai biết vì sao. Ô "Steps" trong bảng đã hỏng đúng như vậy.
 */
export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: (() => void) | null,
): void {
  useEffect(() => {
    const dismiss = onDismiss;
    if (!dismiss) return;

    const handlePointerDown = (event: PointerEvent) => {
      const element = ref.current;
      const target = event.target;
      if (!element || !(target instanceof Node) || element.contains(target)) return;

      const layer = target instanceof Element ? target.closest(LAYERED) : null;
      if (layer && isLayerAbove(layer, element)) return;

      dismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const element = ref.current;
      if (!element) return;
      if ([...document.querySelectorAll(LAYERED)].some((layer) => isLayerAbove(layer, element))) {
        return;
      }

      event.stopPropagation();
      dismiss();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [ref, onDismiss]);
}
