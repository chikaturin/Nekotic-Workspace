import { describe, expect, test } from "vitest";
import { isComposingKey } from "@/lib/dom/ime";
import {
  DEFAULT_STEP_NUMBERING,
  nextStepInsertion,
  parseStepLine,
  spacesAfter,
} from "@/lib/step-numbering";
import type { StepNumbering } from "@/types";

/**
 * Đánh số bước tự động.
 *
 * Luật cũ: Enter luôn lấy số của dòng hiện tại rồi +1. Nên một bước RỖNG vẫn
 * đẩy bộ đếm đi, và người dùng gõ tiếp thì nội dung rơi vào B3 trong khi B2
 * vẫn trống:
 *
 *   B1: A
 *   B2:      ← Enter ở đây
 *   B3: b    ← chữ "b" đáng lẽ thuộc B2
 *
 * Luật mới: chỉ tăng số khi bước hiện tại ĐÃ CÓ nội dung.
 */
const B: StepNumbering = { ...DEFAULT_STEP_NUMBERING, enabled: true, prefix: "B" };

/** Mô phỏng đúng cách textarea chèn: thay selection, caret nằm sau phần chèn. */
function pressEnter(text: string, caret: number, config: StepNumbering) {
  const insertion = nextStepInsertion(text, caret, config);
  const after = caret + spacesAfter(text, caret);

  return {
    text: `${text.slice(0, caret)}${insertion}${text.slice(after)}`,
    caret: caret + insertion.length,
  };
}

const atEnd = (text: string, config: StepNumbering) => pressEnter(text, text.length, config);

describe("parser tách một dòng bước thành các phần", () => {
  test("dòng có nội dung thì hasContent = true", () => {
    expect(parseStepLine("B12: Test payment")).toMatchObject({
      prefix: "B",
      number: 12,
      content: "Test payment",
      hasContent: true,
    });
  });

  test("dòng chỉ có số và dấu phân cách thì hasContent = false", () => {
    expect(parseStepLine("B12:")).toMatchObject({
      prefix: "B",
      number: 12,
      content: "",
      hasContent: false,
    });
  });

  /** T1.2 — khoảng trắng không phải là nội dung. */
  test("chỉ toàn khoảng trắng vẫn là rỗng", () => {
    expect(parseStepLine("B2: ")?.hasContent).toBe(false);
    expect(parseStepLine("B2:      ")?.hasContent).toBe(false);
    expect(parseStepLine("B2:\t")?.hasContent).toBe(false);
  });

  test("không phải dòng bước thì trả null", () => {
    expect(parseStepLine("just some prose")).toBeNull();
  });
});

describe("Enter chỉ tăng số khi bước hiện tại có nội dung", () => {
  /** TEST 1 */
  test("bước có nội dung thì mở bước kế tiếp", () => {
    expect(atEnd("B1: A", B).text).toBe("B1: A\nB2: ");
  });

  /** TEST 2 — cốt lõi của bug. */
  test("Enter trên bước RỖNG không sinh ra bước mới", () => {
    const state = atEnd("B1: A\nB2: ", B);

    expect(state.text).not.toContain("B3");
    expect(state.text).toBe("B1: A\nB2: ");
  });

  /** TEST 7 — Enter liên tục không được đẻ ra một dãy bước rỗng. */
  test("Enter liên tục vẫn đứng yên ở bước đang chờ", () => {
    let state = atEnd("B1: A", B);
    for (let i = 0; i < 5; i++) state = atEnd(state.text, B);

    expect(state.text.match(/B\d+:/g)).toEqual(["B1:", "B2:"]);
  });

  /** TEST 3 + 4 — gõ nội dung vào rồi Enter thì mới đi tiếp. */
  test("gõ nội dung vào bước đang chờ rồi Enter mới sang bước sau", () => {
    const typed = "B1: A\nB2: b";

    expect(atEnd(typed, B).text).toBe("B1: A\nB2: b\nB3: ");
  });

  /** TEST 5 */
  test("tiền tố khác vẫn chạy", () => {
    const T: StepNumbering = { ...B, prefix: "T" };

    expect(atEnd("T1: Login", T).text).toBe("T1: Login\nT2: ");
  });

  /** TEST 6 — số là SỐ, không phải chuỗi. */
  test("B9 có nội dung thì kế tiếp là B10", () => {
    expect(atEnd("B9: Something", B).text).toBe("B9: Something\nB10: ");
  });

  /** T1.6 — số không được suy ra từ số dòng. */
  test("số không tính theo số dòng — dòng trống ở giữa không làm nhảy số", () => {
    expect(nextStepInsertion("B2: has content", "B2: has content".length, B)).toBe("\nB3: ");
    expect(nextStepInsertion("B2:", "B2:".length, B)).toBe("");
  });

  test("dòng không phải bước thì bắt đầu từ số đã cấu hình", () => {
    expect(nextStepInsertion("Preconditions", "Preconditions".length, B)).toBe("\nB1: ");
  });

  /** T1.8 — separator rỗng vẫn dùng được. */
  test("separator rỗng thì token không có dấu phân cách", () => {
    const dash: StepNumbering = { ...B, prefix: "STEP-", separator: "" };

    expect(nextStepInsertion("STEP-1 Login", "STEP-1 Login".length, dash)).toBe("\nSTEP-2");
  });

  /**
   * Shift+Enter đẻ ra dòng nối tiếp không mang số — như "+Kho" thụt lề dưới B2.
   * Bản sửa đầu của tui chỉ nhìn một dòng dưới con trỏ, nên đứng ở dòng đó là
   * mất dấu và số quay về đầu: B1 mọc ra giữa danh sách.
   */
  test("Enter trên dòng nối tiếp vẫn tiếp số của bước phía trên", () => {
    const text = "B1: Login\nB2: Hiển thị: +Thời gian\n      +Kho";

    expect(atEnd(text, B).text).toBe(`${text}\nB3: `);
  });

  test("nhiều dòng nối tiếp liên tiếp cũng không làm mất dấu", () => {
    const text = "B2: Hiển thị\n      +Kho\n      +Phân loại";

    expect(nextStepInsertion(text, text.length, B)).toBe("\nB3: ");
  });

  test("chưa có bước nào phía trên thì mới bắt đầu từ số cấu hình", () => {
    expect(nextStepInsertion("Tiền đề\n  ghi chú", "Tiền đề\n  ghi chú".length, B)).toBe("\nB1: ");
  });

  /** Bước rỗng vẫn phải giữ nguyên luật cũ, kể cả khi phía trên có bước khác. */
  test("bước rỗng ở cuối vẫn không tăng số", () => {
    const text = "B1: A\nB2: B\nB3: ";

    expect(nextStepInsertion(text, text.length, B)).toBe("");
  });

  /** T1.9 — không tự đánh số lại phần đã có. */
  test("không renumber nội dung đã có", () => {
    expect(atEnd("B5: Something", B).text).toBe("B5: Something\nB6: ");
  });
});

/**
 * Bộ gõ tiếng Việt.
 *
 * Người dùng báo: gõ "B1: a" rồi Enter thì ra ngay "B2: B2:" — chèn hai lần
 * cho một cú bấm. Playwright không tái hiện được vì nó bắn phím thẳng, không
 * qua bộ gõ; chỉ người gõ Telex/VNI mới thấy.
 *
 * Nguyên nhân: Enter lúc còn đang ghép chữ bắn `keydown` để CHỐT chữ, rồi bắn
 * tiếp một `keydown` nữa cho chính phím Enter.
 */
describe("phím của bộ gõ không được tính là lệnh", () => {
  test("đang ghép chữ thì bỏ qua", () => {
    expect(isComposingKey({ isComposing: true })).toBe(true);
  });

  test("trình duyệt cũ báo bằng keyCode 229", () => {
    expect(isComposingKey({ keyCode: 229 })).toBe(true);
  });

  test("phím thường thì vẫn xử lý bình thường", () => {
    expect(isComposingKey({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isComposingKey({})).toBe(false);
  });
});
