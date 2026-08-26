"use client";

import { useCallback, useEffect, useRef, type FormEvent } from "react";
import { focusAt } from "@/lib/dom/caret";
import type { CaretPosition, FocusRequest } from "@/types";

interface UseContentEditableInput {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly isEditable: boolean;
  readonly blockId: string;
  readonly focusRequest: FocusRequest | null;
}

/**
 * Bridge between React state and a `contentEditable` node.
 *
 * The DOM is only written when it genuinely diverges from the model, which is
 * what keeps the caret from jumping to the end on every keystroke.
 */
export function useContentEditable({
  value,
  onChange,
  isEditable,
  blockId,
  focusRequest,
}: UseContentEditableInput) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }, [value]);

  const isTargeted = focusRequest?.blockId === blockId;
  const requestedPosition: CaretPosition | number = focusRequest?.position ?? "end";
  const nonce = focusRequest?.nonce ?? 0;

  useEffect(() => {
    if (!isTargeted) return;
    const element = ref.current;
    if (!element) return;

    focusAt(element, requestedPosition);
  }, [isTargeted, requestedPosition, nonce]);

  const handleInput = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      onChange(event.currentTarget.textContent ?? "");
    },
    [onChange],
  );

  /** Paste as plain text — the model has no inline formatting to hold marks. */
  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  return {
    ref,
    editableProps: {
      ref,
      contentEditable: isEditable,
      suppressContentEditableWarning: true,
      onInput: handleInput,
      onPaste: handlePaste,
      role: "textbox" as const,
      "aria-multiline": false,
      spellCheck: true,
    },
  };
}
