import { describe, expect, test } from "vitest";
import { boardCapabilities, settingsSections } from "@/lib/board-settings";
import type { BoardColumn, StepNumbering } from "@/types";

/**
 * Board Settings hiện mục nào là do SCHEMA quyết định.
 *
 * Cái bẫy mà mấy bài dưới đây canh: kiểm theo tên board. Nó chạy đúng trong
 * demo và hỏng ngay lần đầu ai đó đổi tên "QA / QC Board" thành "Payment QA" —
 * mục Step Numbering biến mất mà không ai hiểu vì sao.
 */
const base = {
  id: "",
  name: "",
  position: 0,
  width: 160,
  hidden: false,
  isPrimary: false,
} as const;

const steps: StepNumbering = { enabled: true, prefix: "B", start: 1, separator: ":" };

const longText = (id: string, stepNumbering?: StepNumbering): BoardColumn =>
  ({
    ...base,
    id,
    name: "Step",
    type: "longText",
    config: { rows: 3, ...(stepNumbering ? { stepNumbering } : {}) },
  }) as BoardColumn;

const select = (id: string): BoardColumn =>
  ({ ...base, id, name: "Status", type: "select", config: { options: [], isMulti: false } }) as BoardColumn;

const relation = (id: string): BoardColumn =>
  ({
    ...base,
    id,
    name: "Related Bug",
    type: "relation",
    config: { boardId: "bug", displayColumnId: null, isMulti: true },
  }) as BoardColumn;

const text = (id: string): BoardColumn =>
  ({ ...base, id, name: "Case ID", type: "text", config: {} }) as BoardColumn;

describe("board tự khai nó chỉnh được những gì", () => {
  test("cột long-text ĐÃ BẬT đánh số bước mới tính là step column", () => {
    const withSteps = boardCapabilities([longText("a", steps)]);
    const without = boardCapabilities([longText("a")]);

    expect(withSteps.stepColumns).toHaveLength(1);
    expect(without.stepColumns).toHaveLength(0);
  });

  test("board chỉ có text thì không có Rules lẫn Relations", () => {
    const capabilities = boardCapabilities([text("a")]);

    expect(capabilities.hasRules).toBe(false);
    expect(capabilities.hasRelations).toBe(false);
  });

  test("cột select kéo theo mục Rules — đó là nơi luật chuyển trạng thái sống", () => {
    expect(boardCapabilities([select("s")]).hasRules).toBe(true);
  });

  test("cột quan hệ kéo theo mục Relations", () => {
    expect(boardCapabilities([relation("r")]).hasRelations).toBe(true);
  });
});

describe("các mục hiện trong drawer", () => {
  const labels = (columns: readonly BoardColumn[]) =>
    settingsSections(boardCapabilities(columns)).map((section) => section.label);

  test("board tối giản vẫn có General, Display và Columns", () => {
    expect(labels([text("a")])).toEqual(["General", "Display", "Columns"]);
  });

  /** Giống board QA/QC trong đề bài. */
  test("board có step + select + relation thì đủ năm mục", () => {
    expect(labels([longText("st", steps), select("s"), relation("r")])).toEqual([
      "General",
      "Display",
      "Rules",
      "Columns",
      "Relations",
    ]);
  });

  /** Giống Bug Board: có status và relation, KHÔNG có step numbering. */
  test("board không có step column thì không mọc ra mục Step Numbering rỗng", () => {
    const capabilities = boardCapabilities([select("s"), relation("r")]);

    expect(capabilities.stepColumns).toHaveLength(0);
    // Rules vẫn có, nhưng là vì cột select — không phải vì tên board.
    expect(capabilities.hasRules).toBe(true);
  });
});
