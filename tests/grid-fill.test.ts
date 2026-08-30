import { describe, expect, test } from "vitest";
import { indexRows } from "@/lib/board-records";
import { makeColumn } from "@/lib/board-schema";
import { fillTarget, isFillable, planFill } from "@/lib/grid-fill";
import type { GridSlice } from "@/lib/grid-clipboard";
import type { BoardColumn, BoardColumnOf, BoardRow, CellValue } from "@/types";

/**
 * Fill Handle, tầng dịch sang grid.
 *
 * `fill-series` đã lo "1, 2 thì tiếp theo là gì". Ở đây là những câu khác hẳn:
 * kéo vào ĐÚNG dòng nào (thứ tự đang hiển thị, không phải thứ tự database), cột
 * nào được phép ghi, và kiểu dữ liệu có được giữ nguyên không.
 */

const title = makeColumn("c_title", "Title", "text", 0, { isPrimary: true });

const status: BoardColumnOf<"select"> = {
  ...makeColumn("c_status", "Status", "select", 1),
  type: "select",
  config: {
    isMulti: false,
    options: [
      { id: "o_todo", label: "Todo", color: "gray" },
      { id: "o_doing", label: "Doing", color: "blue" },
    ],
  },
};

const owner: BoardColumnOf<"user"> = {
  ...makeColumn("c_owner", "Owner", "user", 2),
  type: "user",
  config: { isMulti: false },
};

const files: BoardColumnOf<"attachment"> = {
  ...makeColumn("c_files", "Files", "attachment", 3),
  type: "attachment",
  config: { maxFiles: 5 },
};

const related: BoardColumnOf<"relation"> = {
  ...makeColumn("c_rel", "Related QA", "relation", 4),
  type: "relation",
  config: { boardId: "b_qa", displayColumnId: null, isMulti: true },
};

const COLUMNS: readonly BoardColumn[] = [title, status, owner, files, related];

function makeRow(id: string, cells: Readonly<Record<string, CellValue>>): BoardRow {
  return {
    id,
    boardId: "b1",
    displayId: `BUG-00${id.slice(-1)}`,
    sequence: 1,
    cells: {
      c_title: { kind: "text", value: "" },
      c_status: { kind: "select", optionIds: [] },
      c_owner: { kind: "user", userIds: [] },
      c_files: { kind: "attachment", attachments: [] },
      c_rel: { kind: "relation", rowIds: [] },
      ...cells,
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "u1",
    revision: 1,
  };
}

/** `rowIds` là thứ tự HIỂN THỊ — caller truyền vào đúng cái view đang vẽ. */
function sliceOf(rows: readonly BoardRow[], rowIds?: readonly string[]): GridSlice {
  return {
    rowIds: rowIds ?? rows.map((row) => row.id),
    columns: COLUMNS,
    rowsById: indexRows(rows).rowsById,
    context: {
      people: new Map([
        ["u_thanh", { id: "u_thanh", name: "Thanh", email: "t@x.io", initials: "T", isActive: true }],
      ]),
    },
  };
}

const CELL = (box: Partial<{ top: number; left: number; bottom: number; right: number }> = {}) => ({
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  ...box,
});

const blank = ["r1", "r2", "r3", "r4"].map((id) => makeRow(id, {}));

describe("hướng kéo", () => {
  test("kéo lên hoặc sang trái không làm gì", () => {
    // Fill chỉ đi xuôi, như Excel. Kéo ngược lại là một thao tác khác.
    expect(fillTarget(CELL({ top: 2, bottom: 2 }), { rowIndex: 0, columnIndex: 0 })).toBeNull();
  });

  test("kéo xa hơn theo chiều nào thì chọn chiều đó", () => {
    const source = CELL();

    expect(fillTarget(source, { rowIndex: 5, columnIndex: 1 })?.axis).toBe("vertical");
    expect(fillTarget(source, { rowIndex: 1, columnIndex: 5 })?.axis).toBe("horizontal");
  });
});

describe("kéo dọc — ca dùng chính", () => {
  test("chép một giá trị xuống nhiều dòng", () => {
    const rows = [makeRow("r1", { c_title: { kind: "text", value: "Doing" } }), ...blank.slice(1)];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL(),
      pointer: { rowIndex: 3, columnIndex: 0 },
    });

    expect(plan?.edits).toHaveLength(3);
    expect(plan?.edits.map((edit) => edit.rowId)).toEqual(["r2", "r3", "r4"]);
    expect(plan?.edits.every((edit) => edit.value.kind === "text")).toBe(true);
  });

  test("nhận ra dãy B1: và đếm tiếp", () => {
    const rows = [makeRow("r1", { c_title: { kind: "text", value: "B1:" } }), ...blank.slice(1)];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL(),
      pointer: { rowIndex: 3, columnIndex: 0 },
    });

    const texts = plan?.edits.map((edit) =>
      edit.value.kind === "text" ? edit.value.value : "",
    );

    expect(texts).toEqual(["B2:", "B3:", "B4:"]);
  });

  test("hai ô nguồn định ra bước của dãy", () => {
    const rows = [
      makeRow("r1", { c_title: { kind: "text", value: "1" } }),
      makeRow("r2", { c_title: { kind: "text", value: "3" } }),
      ...blank.slice(2),
    ];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL({ bottom: 1 }),
      pointer: { rowIndex: 3, columnIndex: 0 },
    });

    const texts = plan?.edits.map((edit) =>
      edit.value.kind === "text" ? edit.value.value : "",
    );

    expect(texts).toEqual(["5", "7"]);
  });

  test("khối không thành dãy thì lặp lại theo chu kỳ", () => {
    const rows = [
      makeRow("r1", { c_title: { kind: "text", value: "Todo" } }),
      makeRow("r2", { c_title: { kind: "text", value: "Doing" } }),
      ...blank.slice(2),
    ];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL({ bottom: 1 }),
      pointer: { rowIndex: 3, columnIndex: 0 },
    });

    const texts = plan?.edits.map((edit) =>
      edit.value.kind === "text" ? edit.value.value : "",
    );

    expect(texts).toEqual(["Todo", "Doing"]);
  });
});

describe("giữ nguyên tham chiếu, không đi vòng qua text", () => {
  test("select chép đúng optionId, không tạo option mới", () => {
    const rows = [
      makeRow("r1", { c_status: { kind: "select", optionIds: ["o_doing"] } }),
      ...blank.slice(1),
    ];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL({ left: 1, right: 1 }),
      pointer: { rowIndex: 2, columnIndex: 1 },
    });

    for (const edit of plan?.edits ?? []) {
      expect(edit.value).toEqual({ kind: "select", optionIds: ["o_doing"] });
    }
  });

  test("user chép đúng userId, không nhân bản object người dùng", () => {
    const rows = [
      makeRow("r1", { c_owner: { kind: "user", userIds: ["u_thanh"] } }),
      ...blank.slice(1),
    ];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL({ left: 2, right: 2 }),
      pointer: { rowIndex: 2, columnIndex: 2 },
    });

    for (const edit of plan?.edits ?? []) {
      expect(edit.value).toEqual({ kind: "user", userIds: ["u_thanh"] });
    }
  });

  test("relation chép đúng rowIds — không nhân bản bản ghi QA", () => {
    // Đây là C1: kéo relation phải tạo THAM CHIẾU mới tới cùng QA-001, không
    // phải chép chữ "QA-001" vào ô, và tuyệt đối không tạo QA mới.
    const rows = [
      makeRow("r1", { c_rel: { kind: "relation", rowIds: ["qa_1", "qa_3"] } }),
      ...blank.slice(1),
    ];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL({ left: 4, right: 4 }),
      pointer: { rowIndex: 2, columnIndex: 4 },
    });

    expect(plan?.edits).toHaveLength(2);
    for (const edit of plan?.edits ?? []) {
      expect(edit.value).toEqual({ kind: "relation", rowIds: ["qa_1", "qa_3"] });
    }
  });
});

describe("cột được bảo vệ", () => {
  test("attachment không nhận fill", () => {
    expect(isFillable(files)).toBe(false);
    expect(isFillable(title)).toBe(true);
  });

  test("kéo dọc trên cột attachment không sinh edit nào, và có đếm", () => {
    const plan = planFill({
      slice: sliceOf(blank),
      source: CELL({ left: 3, right: 3 }),
      pointer: { rowIndex: 3, columnIndex: 3 },
    });

    expect(plan?.edits).toHaveLength(0);
    expect(plan?.blocked).toBe(3);
  });

  test("cột chính VẪN fill được — đó là ca dùng chính", () => {
    // Điền `B1:`, `B2:`, `B3:` vào cột tiêu đề là lý do tính năng này tồn tại.
    expect(isFillable(title)).toBe(true);
  });
});

describe("kéo ngang", () => {
  test("chỉ đi qua cột cùng kiểu; kiểu khác bị chặn và đếm lại", () => {
    // Text → Select → User: kéo ngang một ô text không được biến thành trạng
    // thái hay người phụ trách.
    const rows = [makeRow("r1", { c_title: { kind: "text", value: "Alpha" } }), ...blank.slice(1)];
    const plan = planFill({
      slice: sliceOf(rows),
      source: CELL(),
      pointer: { rowIndex: 0, columnIndex: 2 },
    });

    expect(plan?.edits).toHaveLength(0);
    expect(plan?.blocked).toBe(2);
  });
});

describe("thứ tự dòng theo VIEW, không theo database", () => {
  test("lọc/sắp xếp rồi thì fill đúng những dòng đang thấy", () => {
    // View chỉ hiện r1, r3 (r2 bị lọc mất). Kéo một dòng phải rơi vào r3.
    const rows = [
      makeRow("r1", { c_title: { kind: "text", value: "Doing" } }),
      makeRow("r2", {}),
      makeRow("r3", {}),
    ];
    const plan = planFill({
      slice: sliceOf(rows, ["r1", "r3"]),
      source: CELL(),
      pointer: { rowIndex: 1, columnIndex: 0 },
    });

    expect(plan?.edits.map((edit) => edit.rowId)).toEqual(["r3"]);
  });
});

describe("quy mô", () => {
  test("kéo 500 dòng ra đúng 500 edit trong MỘT kế hoạch", () => {
    // Không có vòng lặp gọi API nào ở đây: caller nhận một mảng và gửi một lần.
    const many = Array.from({ length: 501 }, (_, index) =>
      makeRow(`r${index}`, index === 0 ? { c_title: { kind: "text", value: "1" } } : {}),
    );
    const plan = planFill({
      slice: sliceOf(many),
      source: CELL(),
      pointer: { rowIndex: 500, columnIndex: 0 },
    });

    expect(plan?.edits).toHaveLength(500);
  });
});
