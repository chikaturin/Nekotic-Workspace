import { afterEach, describe, expect, test } from "vitest";
import { locationSnapshot, subscribeToLocation } from "@/lib/dom/location";

/**
 * Trang được xuất tĩnh, nên mọi mục do người dùng tạo đều nằm ở
 * `/drive/?p=<đường-dẫn>`. Đi từ thư mục này sang thư mục khác vì thế chỉ đổi
 * phần truy vấn — `pathname` giữ nguyên — và `router.push` làm việc đó bằng
 * `history.pushState`, một lời gọi KHÔNG phát ra sự kiện nào.
 *
 * Trước đây chỗ nghe địa chỉ chỉ bắt `popstate`, tức chỉ bắt nút lùi/tiến của
 * trình duyệt. Bấm vào một thư mục thì URL đổi mà màn hình đứng im ở thư mục
 * cũ, phải tải lại trang mới thấy nội dung mới.
 */

interface FakeLocation {
  pathname: string;
  search: string;
}

function installWindow(): { location: FakeLocation; push: (url: string) => void } {
  const bus = new EventTarget();
  const location: FakeLocation = { pathname: "/drive/", search: "" };

  const history = {
    pushState(_data: unknown, _unused: string, url: string): void {
      const [pathname = "", search = ""] = url.split("?");
      location.pathname = pathname;
      location.search = search.length > 0 ? `?${search}` : "";
    },
    replaceState(): void {},
  };

  Reflect.set(globalThis, "window", {
    history,
    location,
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus),
  });

  return {
    location,
    push: (url: string) => {
      const win = Reflect.get(globalThis, "window") as Window;
      win.history.pushState(null, "", url);
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("nghe địa chỉ trang đổi", () => {
  test("báo khi router đẩy một địa chỉ mới bằng pushState", () => {
    const { push } = installWindow();
    let notices = 0;
    subscribeToLocation(() => (notices += 1));

    push("/drive/?p=alpha/beta");

    expect(notices).toBe(1);
  });

  test("ảnh chụp đọc cả phần truy vấn — nơi duy nhất đường dẫn thư mục nằm", () => {
    const { push } = installWindow();
    subscribeToLocation(() => {});

    push("/drive/?p=alpha/beta");

    expect(locationSnapshot()).toBe("/drive/?p=alpha/beta");
  });

  test("vẫn báo khi người dùng bấm nút lùi của trình duyệt", () => {
    installWindow();
    let notices = 0;
    subscribeToLocation(() => (notices += 1));

    const win = Reflect.get(globalThis, "window") as Window;
    win.dispatchEvent(new Event("popstate"));

    expect(notices).toBe(1);
  });

  test("bỏ đăng ký thì thôi báo", () => {
    const { push } = installWindow();
    let notices = 0;
    const stop = subscribeToLocation(() => (notices += 1));

    stop();
    push("/drive/?p=alpha");

    expect(notices).toBe(0);
  });

  test("đăng ký nhiều lần không làm một lần đẩy báo thành nhiều lần", () => {
    const { push } = installWindow();
    let first = 0;
    let second = 0;
    subscribeToLocation(() => (first += 1));
    subscribeToLocation(() => (second += 1));

    push("/drive/?p=alpha");

    expect([first, second]).toEqual([1, 1]);
  });
});
