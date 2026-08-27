"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close a panel when the pointer goes down somewhere else, or on Escape.
 *
 * The grid's cell editors are plain absolutely-positioned surfaces rather than
 * Radix popovers, so they get none of that library's dismissal for free. The
 * text editors have never needed it — they commit on blur — but a panel with no
 * focused field in it, the attachment cell above all, had no way out at all
 * except its own Close button.
 *
 * "Outside" is by intent, not only by DOM position: a dialog, menu or listbox
 * the panel itself opened is portalled to the body and is therefore outside the
 * panel's subtree while plainly being part of it. Closing the editor underneath
 * one would take away the thing the user just opened.
 *
 * Which way round the two are nested is the whole question, and getting it
 * wrong is how a cell editor inside the record drawer became undismissable:
 * the drawer is itself a `role="dialog"`, so a check for "is there a layer on
 * screen" found one every time and handed Escape to the drawer, which closed —
 * taking the record with it because somebody wanted to cancel a date. A layer
 * that *contains* the panel is underneath it, not above it, and never owns a
 * dismissal aimed at the panel.
 */
const LAYERED = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  "[data-radix-popper-content-wrapper]",
].join(",");

/** A surface a dismissal belongs to instead: on top of `panel`, not around it. */
function isLayerAbove(layer: Element, panel: HTMLElement): boolean {
  return !layer.contains(panel);
}

export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const element = ref.current;
      const target = event.target;
      if (!element || !(target instanceof Node) || element.contains(target)) return;

      // A press inside a layer above the panel is that layer's. A press inside
      // the surface the panel is *hosted* in — the drawer's own body — is an
      // ordinary click outside the panel and dismisses it.
      const layer = target instanceof Element ? target.closest(LAYERED) : null;
      if (layer && isLayerAbove(layer, element)) return;

      onDismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Only when nothing layered is on top: Escape belongs to the topmost
      // surface, and a viewer opened from inside the panel is above it.
      if (event.key !== "Escape") return;

      const element = ref.current;
      if (!element) return;
      if ([...document.querySelectorAll(LAYERED)].some((layer) => isLayerAbove(layer, element))) {
        return;
      }

      event.stopPropagation();
      onDismiss();
    }

    // Capture, so a handler inside the page cannot swallow the dismissal.
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [ref, onDismiss]);
}
