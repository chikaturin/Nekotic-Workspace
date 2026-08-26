/**
 * Caret helpers for `contentEditable` blocks. Browser-only by nature — they
 * take an element and talk to the live selection, so they are exercised through
 * the editor rather than in unit tests.
 */

export function getCaretOffset(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const probe = range.cloneRange();
  probe.selectNodeContents(element);
  probe.setEnd(range.endContainer, range.endOffset);

  return probe.toString().length;
}

export function setCaretOffset(element: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  const target = Math.max(0, Math.min(offset, element.textContent?.length ?? 0));

  let remaining = target;
  let placed = false;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      range.setStart(node, remaining);
      placed = true;
      break;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  if (!placed) {
    range.selectNodeContents(element);
    range.collapse(false);
  } else {
    range.collapse(true);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export function focusAt(element: HTMLElement, position: "start" | "end" | number): void {
  element.focus({ preventScroll: true });

  if (position === "start") {
    setCaretOffset(element, 0);
    return;
  }
  if (position === "end") {
    setCaretOffset(element, element.textContent?.length ?? 0);
    return;
  }
  setCaretOffset(element, position);
}

export function isCaretAtStart(element: HTMLElement): boolean {
  return getCaretOffset(element) === 0;
}

export function isCaretAtEnd(element: HTMLElement): boolean {
  return getCaretOffset(element) === (element.textContent?.length ?? 0);
}

/** True when the selection covers characters rather than sitting between them. */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}
