/**
 * Nghe địa chỉ trang đổi — kể cả khi router đổi bằng `history.pushState`.
 *
 * Trình duyệt chỉ phát `popstate` khi người dùng bấm lùi/tiến. Điều hướng bên
 * trong ứng dụng — `<Link>` và `router.push` của Next — đi qua
 * `history.pushState`, và lời gọi đó KHÔNG phát ra sự kiện nào cả.
 *
 * Vì trang được xuất tĩnh, mọi mục do người dùng tạo đều nằm ở
 * `/drive/?p=<đường-dẫn>`: bấm từ thư mục này sang thư mục khác chỉ đổi phần
 * truy vấn, còn `pathname` giữ nguyên. React do đó không có lý do nào để vẽ
 * lại, và màn hình đứng im ở thư mục cũ cho tới khi tải lại trang.
 *
 * Bọc `pushState`/`replaceState` là cách duy nhất nghe được việc này mà không
 * phải dùng `useSearchParams` — hook đó đòi một ranh giới `<Suspense>` ở chế độ
 * xuất tĩnh.
 */
const LOCATION_EVENT = "nekotic:locationchange";
const PATCH_FLAG = "__nekoticLocationEvents";

type HistoryWriter = "pushState" | "replaceState";

function wrap(method: HistoryWriter): void {
  const original = window.history[method];

  window.history[method] = function announced(
    this: History,
    ...args: Parameters<History[HistoryWriter]>
  ): void {
    original.apply(this, args);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  };
}

/**
 * Bọc một lần duy nhất cho mỗi trang.
 *
 * Cờ nằm trên `window.history` chứ không phải biến trong module: khi thay nóng
 * mã nguồn lúc phát triển, module được nạp lại còn `history` thì không — giữ cờ
 * ở đây thì không bao giờ bọc chồng lên nhau.
 */
function patchHistory(): void {
  const flags = window.history as History & Record<string, unknown>;
  if (flags[PATCH_FLAG] === true) return;

  flags[PATCH_FLAG] = true;
  wrap("pushState");
  wrap("replaceState");
}

const LOCATION_EVENTS: readonly string[] = ["popstate", "hashchange", LOCATION_EVENT];

export function subscribeToLocation(onChange: () => void): () => void {
  patchHistory();
  for (const name of LOCATION_EVENTS) window.addEventListener(name, onChange);

  return () => {
    for (const name of LOCATION_EVENTS) window.removeEventListener(name, onChange);
  };
}

export function locationSnapshot(): string {
  return `${window.location.pathname}${window.location.search}`;
}
