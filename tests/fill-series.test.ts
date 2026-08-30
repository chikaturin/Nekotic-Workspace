import { describe, expect, test } from "vitest";
import { detectFillPattern, projectFillValue } from "@/lib/fill-series";

/**
 * Bộ dò dãy cho Fill Handle.
 *
 * Test theo BẢNG vì đây là logic thuần: mỗi hàng là "chọn cái này, kéo ra, phải
 * ra cái kia". Không dựng grid, không render gì.
 *
 * Câu hỏi xuyên suốt không phải "đoán được bao nhiêu quy luật" mà là "khi không
 * chắc thì có chịu chép lại không" — một cú đoán sai âm thầm ghi đè dữ liệu tệ
 * hơn hẳn việc không đoán.
 */

/** Kéo `count` ô tiếp theo từ khối nguồn `values`. */
function drag(values: readonly string[], count: number): readonly (string | null)[] {
  const pattern = detectFillPattern(values);

  return Array.from({ length: count }, (_, index) =>
    projectFillValue(pattern, index + 1),
  );
}

describe("số thuần", () => {
  test("một ô số KHÔNG tự đếm lên — chép lại", () => {
    // Excel cũng vậy, và lý do rất thực tế: một ô `5` thường là con số 5, không
    // phải "mục số 5". Muốn đếm thì chọn hai ô để nói rõ bước.
    expect(detectFillPattern(["5"]).kind).toBe("copy");
  });

  test("hai ô liên tiếp thành dãy bước 1", () => {
    expect(drag(["1", "2"], 4)).toEqual(["3", "4", "5", "6"]);
  });

  test("bước 2 được giữ nguyên", () => {
    expect(drag(["2", "4"], 3)).toEqual(["6", "8", "10"]);
  });

  test("bước âm đếm lùi", () => {
    expect(drag(["10", "8"], 3)).toEqual(["6", "4", "2"]);
  });

  test("bước không đều thì không phải dãy", () => {
    // `1, 2, 5` không có quy luật nào an toàn để suy ra.
    expect(detectFillPattern(["1", "2", "5"]).kind).toBe("copy");
  });
});

describe("tiền tố + số + hậu tố", () => {
  test("B1: kéo xuống thành B2:, B3:", () => {
    expect(drag(["B1:"], 3)).toEqual(["B2:", "B3:", "B4:"]);
  });

  test("một ô CÓ khung chữ thì tự đếm — khác với số thuần", () => {
    // `B1:` không mang nghĩa nào khác ngoài "mục số 1", nên tăng là đoán đúng.
    expect(detectFillPattern(["B1:"]).kind).toBe("text-number");
    expect(detectFillPattern(["1"]).kind).toBe("copy");
  });

  test("T1, T2 tiếp tục thành T3, T4", () => {
    expect(drag(["T1", "T2"], 2)).toEqual(["T3", "T4"]);
  });

  test("Step 1 thành Step 2, Step 3", () => {
    expect(drag(["Step 1"], 2)).toEqual(["Step 2", "Step 3"]);
  });

  test("giữ số 0 đứng đầu và tự nới khi tràn", () => {
    expect(drag(["TEST-001", "TEST-002"], 2)).toEqual(["TEST-003", "TEST-004"]);
    // 08 → 09 → 10: hết chỗ thì số thắng, không cắt cụt thành `Case 1`.
    expect(drag(["Case 08"], 3)).toEqual(["Case 09", "Case 10", "Case 11"]);
  });

  test("không padding thì không tự thêm", () => {
    expect(drag(["Case 8"], 2)).toEqual(["Case 9", "Case 10"]);
  });

  test("lấy cụm số CUỐI, không phải cụm đầu", () => {
    // Cái người ta muốn tăng luôn nằm ở cuối.
    expect(drag(["Sprint 3 - Task 1"], 2)).toEqual([
      "Sprint 3 - Task 2",
      "Sprint 3 - Task 3",
    ]);
  });

  test("khung chữ khác nhau thì không phải một dãy", () => {
    // `B1` và `T2` chỉ tình cờ cùng có số ở cuối.
    expect(detectFillPattern(["B1", "T2"]).kind).toBe("copy");
  });
});

describe("ngày", () => {
  test("một ngày đơn thì chép, không tăng", () => {
    // Đây là lựa chọn UX: tăng ngày khi người ta chỉ muốn điền cùng một hạn là
    // kiểu bất ngờ khó chịu nhất trong cả bộ.
    expect(detectFillPattern(["2026-08-27"]).kind).toBe("copy");
  });

  test("hai ngày liên tiếp thành dãy ngày", () => {
    const [first, second] = drag(["2026-08-27", "2026-08-28"], 2);

    expect(first?.slice(0, 10)).toBe("2026-08-29");
    expect(second?.slice(0, 10)).toBe("2026-08-30");
  });

  test("bước 7 ngày được giữ", () => {
    const [next] = drag(["2026-08-03", "2026-08-10"], 1);

    expect(next?.slice(0, 10)).toBe("2026-08-17");
  });

  test("qua ranh giới tháng vẫn đúng", () => {
    const [first, second] = drag(["2026-08-30", "2026-08-31"], 2);

    expect(first?.slice(0, 10)).toBe("2026-09-01");
    expect(second?.slice(0, 10)).toBe("2026-09-02");
  });

  test("ngày được thử TRƯỚC text-number", () => {
    // `2026-08-27` cũng "có số ở cuối"; nếu thử sai thứ tự thì nó thành
    // `2026-08-28` theo đường text và trông y hệt — cho tới khi gặp `2026-08-31`,
    // lúc đó sinh ra `2026-08-32`.
    const pattern = detectFillPattern(["2026-08-30", "2026-08-31"]);

    expect(pattern.kind).toBe("date");
  });
});

describe("khi không chắc thì chép", () => {
  test("chữ thuần không có số", () => {
    expect(detectFillPattern(["Doing"]).kind).toBe("copy");
    expect(detectFillPattern(["Todo", "Doing"]).kind).toBe("copy");
  });

  test("khối rỗng hoặc có ô trống", () => {
    expect(detectFillPattern([]).kind).toBe("copy");
    expect(detectFillPattern(["1", ""]).kind).toBe("copy");
    expect(detectFillPattern(["   "]).kind).toBe("copy");
  });

  test("số quá dài không được coi là số thứ tự", () => {
    // Số điện thoại, mã vạch, id — tăng lên một đơn vị là vô nghĩa.
    expect(detectFillPattern(["0912345678901234567"]).kind).toBe("copy");
  });

  test("copy trả null để caller tự lặp lại khối nguồn", () => {
    expect(projectFillValue({ kind: "copy" }, 1)).toBeNull();
  });
});
