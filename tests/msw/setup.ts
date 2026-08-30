import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { CURRENT_USER } from "@/mock/users";
import { useSessionStore } from "@/store/session-store";
import { resetDb } from "./db";
import { boardFake } from "./fake/board.fake";
import { collabFake } from "./fake/collab.fake";
import { auditFake } from "./fake/audit.fake";
import { devtoolsFake } from "./fake/devtools.fake";
import { resetFileFake } from "./handlers/file";
import { documentFake } from "./fake/document.fake";
import { server } from "./server";

/**
 * `onUnhandledRequest: "error"` là CÓ CHỦ ĐÍCH.
 *
 * Mặc định MSW để request không khớp handler đi thẳng ra mạng thật — nghĩa là
 * một test gọi nhầm endpoint sẽ treo cho tới khi timeout, hoặc tệ hơn, thật sự
 * chạm vào backend đang chạy trên máy. Ném lỗi ngay chỉ thẳng vào endpoint bị
 * thiếu handler.
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  /**
   * Mọi test bắt đầu ở trạng thái ĐÃ ĐĂNG NHẬP.
   *
   * `currentUser()` ném khi chưa có phiên, và đó là hành vi đúng của sản phẩm:
   * một lần ghi không có tác giả là lỗi lập trình. Nhưng gần như mọi test ở đây
   * kiểm hành vi SAU khi đăng nhập, nên dựng sẵn phiên ở một chỗ vẫn tốt hơn
   * lặp lại nó trong năm mươi bảy file.
   */
  useSessionStore.setState({
    status: "ready",
    user: CURRENT_USER,
    workspaces: [],
    activeWorkspaceId: null,
  });

  resetDb();
  documentFake.reset();
  collabFake.reset();
  devtoolsFake.reset();
  boardFake.reset();
  auditFake.reset();
  resetFileFake();
});

afterEach(() => {
  // Gỡ mọi handler mà một test tự thêm bằng `server.use(...)`: không gỡ thì
  // một lần giả lỗi 500 sẽ theo sang những test chạy sau nó.
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
