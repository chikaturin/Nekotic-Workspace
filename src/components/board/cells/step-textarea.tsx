"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import { useModKeyLabel } from "@/hooks/use-mod-key";
import { arrowExitDirection, type CellExit } from "@/lib/cell-arrow-exit";
import { isComposingKey } from "@/lib/dom/ime";
import {
  indentSelection,
  nextStepInsertion,
  numberPastedLines,
  outdentSelection,
  spacesAfter,
} from "@/lib/step-numbering";
import { cn } from "@/lib/utils";
import type { StepNumbering } from "@/types";

/** Trần chiều cao của ô inline, để nó không tràn ra ngoài màn hình. */
const MAX_INLINE_HEIGHT_PX = 420;

interface StepTextareaProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly steps?: StepNumbering | undefined;
  readonly rows?: number;
  readonly autoFocus?: boolean;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  readonly onBlur?: (() => void) | undefined;
  /**
   * Rời ô bằng mũi tên khi con trỏ đã chạm biên đoạn chữ.
   *
   * Chỉ ô inline trong bảng truyền hàm này. Bản toàn màn hình không có ô nào
   * bên cạnh để đi tới, nên ở đó mũi tên luôn thuộc về đoạn chữ.
   */
  readonly onExit?: ((direction: CellExit) => void) | undefined;
  readonly label: string;
  readonly className?: string;
}

export function StepTextarea({
  value,
  onChange,
  steps,
  rows,
  autoFocus = false,
  onSubmit,
  onCancel,
  onBlur,
  onExit,
  label,
  className,
}: StepTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const isNumbering = steps?.enabled === true;

  /**
   * Ô soạn thảo cao bằng nội dung của nó.
   *
   * `rows` là chiều cao MẶC ĐỊNH của cột, không phải chiều cao của ô này. Ô có
   * 12 bước mà mở ra chỉ 3 dòng kèm thanh cuộn thì nhỏ hơn cả chỗ nó vừa che
   * đi — người dùng bấm sửa và thấy ít chữ hơn lúc chưa sửa.
   *
   * Chỉ chạy khi có `rows`: bản toàn màn hình đặt chiều cao bằng `h-full` và
   * không cần ai chỉnh hộ.
   */
  useEffect(() => {
    const area = ref.current;
    if (!area || rows === undefined) return;

    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, MAX_INLINE_HEIGHT_PX)}px`;
  }, [value, rows]);

  useEffect(() => {
    if (!autoFocus) return;
    const area = ref.current;
    if (!area) return;

    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [autoFocus]);

  /**
   * Thay đoạn đang chọn, và GIỮ ĐƯỢC Cmd/Ctrl+Z.
   *
   * `setRangeText` sửa thẳng DOM nên trình duyệt không ghi gì vào ngăn xếp hoàn
   * tác: số bước do Enter tự chèn sẽ không thể hoàn tác. `execCommand`
   * ("insertText") thì có — nó tuy đã cũ nhưng vẫn là cách duy nhất viết vào
   * ngăn xếp đó, và có `setRangeText` đỡ phía sau nếu trình duyệt từ chối.
   */
  function replaceRange(from: number, to: number, text: string) {
    const area = ref.current;
    if (!area) return;

    area.setSelectionRange(from, to);

    if (!document.execCommand("insertText", false, text)) {
      area.setRangeText(text, from, to, "end");
    }

    onChange(area.value);
  }

  function insert(insertion: string, absorbSpaces = false) {
    const area = ref.current;
    if (!area) return;

    const end =
      absorbSpaces && area.selectionStart === area.selectionEnd
        ? area.selectionEnd + spacesAfter(area.value, area.selectionEnd)
        : area.selectionEnd;

    replaceRange(area.selectionStart, end, insertion);
  }

  function rewrite(edit: { text: string; selectionStart: number; selectionEnd: number }) {
    const area = ref.current;
    if (!area) return;
    if (edit.text === area.value) return;

    replaceRange(0, area.value.length, edit.text);
    area.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const area = event.currentTarget;

    // Bộ gõ đang ghép chữ: phím này thuộc về nó, không phải lệnh của người dùng.
    if (isComposingKey(event.nativeEvent)) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    const exit = onExit
      ? arrowExitDirection({
          key: event.key,
          hasModifier: event.metaKey || event.ctrlKey || event.altKey || event.shiftKey,
          value: area.value,
          selectionStart: area.selectionStart,
          selectionEnd: area.selectionEnd,
          isMultiline: true,
        })
      : null;

    if (exit) {
      event.preventDefault();
      onExit?.(exit);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const edit = event.shiftKey
        ? outdentSelection(area.value, area.selectionStart, area.selectionEnd)
        : indentSelection(area.value, area.selectionStart, area.selectionEnd);
      rewrite(edit);
      return;
    }

    if (event.key !== "Enter") return;

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      onSubmit();
      return;
    }

    if (event.shiftKey || !isNumbering || !steps) return;

    event.preventDefault();

    const insertion = nextStepInsertion(area.value, area.selectionStart, steps);

    // Rỗng nghĩa là bước hiện tại chưa viết gì: đứng yên. Không chèn — và nhất
    // là không chèn với `absorbSpaces`, vì như thế sẽ NUỐT khoảng trắng sau
    // con trỏ mà chẳng bù lại gì.
    if (insertion === "") return;

    insert(insertion, true);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!isNumbering || !steps) return;

    const numbered = numberPastedLines(event.clipboardData.getData("text/plain"), steps);
    if (!numbered) return;

    event.preventDefault();
    insert(numbered);
  }

  return (
    <Textarea
      ref={ref}
      variant="ghost"
      value={value}
      {...(rows === undefined ? {} : { rows })}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...(onBlur ? { onBlur } : {})}
      aria-label={label}
      className={cn("w-full p-2 text-lead leading-relaxed", className)}
    />
  );
}

export function StepHints({ isNumbering }: { readonly isNumbering: boolean }) {
  const modKey = useModKeyLabel();

  return (
    <>
      <Kbd>{modKey}</Kbd>
      <Kbd>↵</Kbd>
      to save
      {isNumbering && (
        <>
          <span className="mx-0.5">·</span>
          <Kbd>↵</Kbd>
          next step
          <span className="mx-0.5">·</span>
          <Kbd>⇧</Kbd>
          <Kbd>↵</Kbd>
          new line
        </>
      )}
      <span className="mx-0.5">·</span>
      <Kbd>⇥</Kbd>
      indent
    </>
  );
}
