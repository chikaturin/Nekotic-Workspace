import { beforeEach, describe, expect, test } from "vitest";
import { arrowExitDirection, type ArrowExitInput } from "@/lib/cell-arrow-exit";
import {
  closePopupLayer,
  openPopupLayer,
  openPopupLayerIds,
  resetPopupLayers,
} from "@/lib/popup-registry";

function press(overrides: Partial<ArrowExitInput> & { key: string }): ArrowExitInput {
  return {
    hasModifier: false,
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    isMultiline: false,
    ...overrides,
  };
}

describe("arrowExitDirection — ô một dòng", () => {
  test("con trỏ ở cuối chữ thì mũi tên phải rời ô", () => {
    // Arrange
    const input = press({ key: "ArrowRight", value: "abc", selectionStart: 3, selectionEnd: 3 });

    // Act
    const direction = arrowExitDirection(input);

    // Assert
    expect(direction).toBe("right");
  });

  test("con trỏ còn ở giữa chữ thì mũi tên phải thuộc về đoạn chữ", () => {
    const input = press({ key: "ArrowRight", value: "abc", selectionStart: 1, selectionEnd: 1 });

    expect(arrowExitDirection(input)).toBeNull();
  });

  test("con trỏ ở đầu chữ thì mũi tên trái rời ô", () => {
    const input = press({ key: "ArrowLeft", value: "abc", selectionStart: 0, selectionEnd: 0 });

    expect(arrowExitDirection(input)).toBe("left");
  });

  test("con trỏ chưa ở đầu chữ thì mũi tên trái vẫn đi lùi trong chữ", () => {
    const input = press({ key: "ArrowLeft", value: "abc", selectionStart: 2, selectionEnd: 2 });

    expect(arrowExitDirection(input)).toBeNull();
  });

  test("lên xuống luôn rời ô vì ô một dòng không có dòng nào để đi", () => {
    const middle = { value: "abc", selectionStart: 1, selectionEnd: 1 };

    expect(arrowExitDirection(press({ key: "ArrowUp", ...middle }))).toBe("up");
    expect(arrowExitDirection(press({ key: "ArrowDown", ...middle }))).toBe("down");
  });

  test("đang bôi đen một đoạn thì không rời ô", () => {
    const input = press({ key: "ArrowRight", value: "abc", selectionStart: 0, selectionEnd: 3 });

    expect(arrowExitDirection(input)).toBeNull();
  });

  test("có phím bổ trợ thì trả quyền lại cho trình duyệt", () => {
    const atEnd = { value: "abc", selectionStart: 3, selectionEnd: 3 };

    expect(arrowExitDirection(press({ key: "ArrowRight", hasModifier: true, ...atEnd }))).toBeNull();
  });

  test("phím không phải mũi tên thì không liên quan", () => {
    expect(arrowExitDirection(press({ key: "Enter" }))).toBeNull();
    expect(arrowExitDirection(press({ key: "a" }))).toBeNull();
  });

  test("ô rỗng thì mũi tên nào cũng rời ô", () => {
    expect(arrowExitDirection(press({ key: "ArrowLeft" }))).toBe("left");
    expect(arrowExitDirection(press({ key: "ArrowRight" }))).toBe("right");
  });
});

describe("arrowExitDirection — ô nhiều dòng", () => {
  const steps = "B1: a\nB2: b\nB3: c";
  const secondLine = steps.indexOf("B2");

  test("đang ở dòng giữa thì lên xuống đi giữa các dòng", () => {
    const middle = {
      value: steps,
      selectionStart: secondLine,
      selectionEnd: secondLine,
      isMultiline: true,
    };

    expect(arrowExitDirection(press({ key: "ArrowUp", ...middle }))).toBeNull();
    expect(arrowExitDirection(press({ key: "ArrowDown", ...middle }))).toBeNull();
  });

  test("ở dòng đầu thì mũi tên lên rời ô", () => {
    const input = press({
      key: "ArrowUp",
      value: steps,
      selectionStart: 2,
      selectionEnd: 2,
      isMultiline: true,
    });

    expect(arrowExitDirection(input)).toBe("up");
  });

  test("ở dòng cuối thì mũi tên xuống rời ô", () => {
    const input = press({
      key: "ArrowDown",
      value: steps,
      selectionStart: steps.length,
      selectionEnd: steps.length,
      isMultiline: true,
    });

    expect(arrowExitDirection(input)).toBe("down");
  });

  test("trái phải vẫn xét theo đầu và cuối cả đoạn, không phải theo dòng", () => {
    const endOfFirstLine = steps.indexOf("\n");

    expect(
      arrowExitDirection(
        press({
          key: "ArrowRight",
          value: steps,
          selectionStart: endOfFirstLine,
          selectionEnd: endOfFirstLine,
          isMultiline: true,
        }),
      ),
    ).toBeNull();

    expect(
      arrowExitDirection(
        press({
          key: "ArrowRight",
          value: steps,
          selectionStart: steps.length,
          selectionEnd: steps.length,
          isMultiline: true,
        }),
      ),
    ).toBe("right");
  });
});

describe("sổ đăng ký popup", () => {
  beforeEach(() => {
    resetPopupLayers();
  });

  test("mở popup thứ hai thì popup thứ nhất bị đóng", () => {
    // Arrange
    const closed: string[] = [];
    openPopupLayer("status", ["status"], () => closed.push("status"));

    // Act
    openPopupLayer("assign", ["assign"], () => closed.push("assign"));

    // Assert
    expect(closed).toEqual(["status"]);
    expect(openPopupLayerIds()).toEqual(["assign"]);
  });

  test("popup lồng bên trong KHÔNG đóng popup cha của nó", () => {
    const closed: string[] = [];
    openPopupLayer("filter", ["filter"], () => closed.push("filter"));

    openPopupLayer("date", ["filter", "date"], () => closed.push("date"));

    expect(closed).toEqual([]);
    expect(openPopupLayerIds()).toEqual(["filter", "date"]);
  });

  test("mở một popup ngoài nhánh thì cả nhánh đang mở bị đóng", () => {
    const closed: string[] = [];
    openPopupLayer("filter", ["filter"], () => closed.push("filter"));
    openPopupLayer("date", ["filter", "date"], () => closed.push("date"));

    openPopupLayer("sort", ["sort"], () => closed.push("sort"));

    expect(closed.sort()).toEqual(["date", "filter"]);
    expect(openPopupLayerIds()).toEqual(["sort"]);
  });

  test("mở lại chính nó thì không tự đóng mình", () => {
    const closed: string[] = [];
    openPopupLayer("status", ["status"], () => closed.push("status"));

    openPopupLayer("status", ["status"], () => closed.push("status"));

    expect(closed).toEqual([]);
    expect(openPopupLayerIds()).toEqual(["status"]);
  });

  test("popup đã đóng thì không còn bị gọi đóng lần nữa", () => {
    const closed: string[] = [];
    openPopupLayer("status", ["status"], () => closed.push("status"));
    closePopupLayer("status");

    openPopupLayer("assign", ["assign"], () => closed.push("assign"));

    expect(closed).toEqual([]);
  });
});
