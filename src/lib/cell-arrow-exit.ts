/**
 * Mũi tên có đưa con trỏ RA KHỎI ô đang gõ không.
 *
 * Trong bảng tính, mũi tên vừa là "đi chữ" vừa là "đi ô". Cắt cứng theo một
 * nghĩa thì mất nghĩa kia: bắt mũi tên luôn nhảy ô thì không sửa nổi một chữ
 * lỡ gõ sai ở giữa câu, còn để nó luôn đi chữ thì gõ xong phải với tay lấy
 * chuột.
 *
 * Cách phân xử ở đây là theo BIÊN: khi con trỏ còn chỗ để đi trong ô thì mũi
 * tên thuộc về đoạn chữ; khi nó đã chạm biên theo hướng đó thì cú bấm tiếp theo
 * là ý muốn rời ô. Gõ xong một ô thì con trỏ đang ở cuối, nên "→" rời ô ngay —
 * đúng như người dùng mong đợi.
 */
export type CellExit = "up" | "down" | "left" | "right";

/** Hướng ghi xong ô rồi đi tiếp; `"none"` là ghi xong nhưng đứng yên. */
export type CellMove = CellExit | "none";

export interface ArrowExitInput {
  readonly key: string;
  /** Có phím bổ trợ đi kèm — lúc đó mũi tên là lệnh chọn/nhảy của trình duyệt. */
  readonly hasModifier: boolean;
  readonly value: string;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
  /** Ô nhiều dòng: lên/xuống còn phải đi giữa các dòng trước khi rời ô. */
  readonly isMultiline: boolean;
}

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function isOnFirstLine(value: string, caret: number): boolean {
  return !value.slice(0, caret).includes("\n");
}

function isOnLastLine(value: string, caret: number): boolean {
  return !value.slice(caret).includes("\n");
}

export function arrowExitDirection(input: ArrowExitInput): CellExit | null {
  if (!ARROWS.has(input.key) || input.hasModifier) return null;

  const { selectionStart: start, selectionEnd: end } = input;

  // Đang bôi đen một đoạn: mũi tên là để bỏ bôi đen, không phải để rời ô.
  if (start === null || end === null || start !== end) return null;

  switch (input.key) {
    case "ArrowLeft":
      return start === 0 ? "left" : null;
    case "ArrowRight":
      return start === input.value.length ? "right" : null;
    case "ArrowUp":
      return !input.isMultiline || isOnFirstLine(input.value, start) ? "up" : null;
    default:
      return !input.isMultiline || isOnLastLine(input.value, start) ? "down" : null;
  }
}
